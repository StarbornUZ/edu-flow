"""Live Sessions — WebSocket + REST endpoints.

REST:
  GET    /api/v1/live-sessions/                → sessiyalar ro'yxati (o'qituvchi: o'z sessiyalari, talaba: o'z sinf sessiyalari)
  POST   /api/v1/live-sessions/                → sessiya yaratish (Teacher)
  GET    /api/v1/live-sessions/{id}            → sessiya ma'lumotlari
  POST   /api/v1/live-sessions/{id}/teams      → guruhlarni belgilash (Teacher)
  POST   /api/v1/live-sessions/{id}/start      → boshlash (Teacher)
  POST   /api/v1/live-sessions/{id}/next       → keyingi savol (Teacher)
  POST   /api/v1/live-sessions/{id}/end        → yakunlash (Teacher)
  GET    /api/v1/live-sessions/{id}/results    → natijalar (barcha)
  GET    /api/v1/live-sessions/{id}/my-results → talabaning shaxsiy natijalari

WebSocket:
  WS     /api/v1/live-sessions/ws/{id}?token=  → musobaqaga ulash
"""
from __future__ import annotations

import random
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db, get_current_user, CurrentTeacher, CurrentUser, DBSession, _require_teacher_or_admin as require_teacher
from backend.db.models.class_ import Class, ClassEnrollment, ClassEnrollmentStatus
from backend.db.models.live_session import (
    GameType,
    LiveSession,
    LiveSessionParticipant,
    LiveSessionTeam,
    SessionStatus,
)
from backend.db.models.notification import Notification
from backend.db.models.user import User, UserRole
from backend.services.live_session_service import GameEngine, manager

router = APIRouter(prefix="/live-sessions", tags=["live-sessions"])

# Jamoa ranglari (guruh uchun)
TEAM_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"]


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    game_type: GameType
    session_type: str = "group_battle"      # "class_battle" | "group_battle"
    class_ids: list[uuid.UUID] = []         # class_battle: 2+ sinf; group_battle: 1 sinf
    course_id: uuid.UUID | None = None
    config: dict = {}
    questions: list[dict] = []
    group_count: int = 2                    # group_battle: guruh soni
    grouping_method: str = "random"         # "random" | "ai"


class SessionResponse(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    game_type: str
    status: str
    session_type: str = "group_battle"
    class_ids: list = []
    config: dict
    questions: list = []
    current_question_index: int = 0
    teacher_name: str | None = None
    my_score: int | None = None
    model_config = {"from_attributes": True}


# ─── GET /live-sessions/ ─────────────────────────────────────────────────────

@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchi uchun tegishli sessiyalarni qaytaradi.

    O'qituvchi → o'zi yaratgan sessiyalar.
    Talaba → o'zi a'zo bo'lgan sinflar bilan bog'liq sessiyalar.
    """
    if current_user.role in (UserRole.teacher, UserRole.org_admin, UserRole.admin):
        result = await db.execute(
            select(LiveSession)
            .where(LiveSession.teacher_id == current_user.id)
            .order_by(LiveSession.created_at.desc())
        )
        sessions = result.scalars().all()
    else:
        # Talaba: o'zi a'zo sinflarni topamiz
        enrollment_result = await db.execute(
            select(ClassEnrollment.class_id)
            .where(
                ClassEnrollment.student_id == current_user.id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
        )
        student_class_ids = [str(row[0]) for row in enrollment_result.all()]

        if not student_class_ids:
            return []

        # class_ids JSON maydonida talabaning sinfi mavjud sessiyalar
        result = await db.execute(
            select(LiveSession).order_by(LiveSession.created_at.desc())
        )
        all_sessions = result.scalars().all()
        sessions = [
            s for s in all_sessions
            if any(str(cid) in student_class_ids for cid in (s.class_ids or []))
        ]

    # O'qituvchi nomlarini yuklash
    teacher_ids = list({s.teacher_id for s in sessions})
    teacher_map: dict[uuid.UUID, str] = {}
    if teacher_ids:
        teachers_result = await db.execute(select(User).where(User.id.in_(teacher_ids)))
        for t in teachers_result.scalars().all():
            teacher_map[t.id] = t.full_name

    # Talaba uchun my_score qo'shish
    my_score_map: dict[uuid.UUID, int] = {}
    if current_user.role == UserRole.student:
        session_ids = [s.id for s in sessions]
        if session_ids:
            part_result = await db.execute(
                select(LiveSessionParticipant).where(
                    LiveSessionParticipant.student_id == current_user.id,
                    LiveSessionParticipant.session_id.in_(session_ids),
                )
            )
            for p in part_result.scalars().all():
                my_score_map[p.session_id] = p.personal_score

    output = []
    for s in sessions:
        data = SessionResponse.model_validate(s)
        data.teacher_name = teacher_map.get(s.teacher_id)
        data.my_score = my_score_map.get(s.id)
        output.append(data)
    return output


# ─── POST /live-sessions/ ─────────────────────────────────────────────────────

@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Yangi musobaqa sessiyasi yaratish."""
    session = LiveSession(
        teacher_id=current_user.id,
        course_id=body.course_id,
        game_type=body.game_type,
        session_type=body.session_type,
        class_ids=[str(cid) for cid in body.class_ids],
        config=body.config,
        questions=body.questions,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Guruhlarni avtomatik tuzish
    notif_student_ids = await _auto_assign_teams(session, body, db)

    # Tegishli talabalarni xabardor qilish
    game_type_label = {
        "blitz": "Blitz Jang",
        "lucky_card": "Omad Sinovi",
        "relay": "Zanjir Savol",
        "question_duel": "Savol Dueli",
        "territory": "Xarita Jang",
        "pyramid": "Piramida",
        "puzzle": "Topishmoq",
    }.get(session.game_type.value, session.game_type.value)

    for student_id in notif_student_ids:
        notif = Notification(
            user_id=student_id,
            type="live_session_invite",
            title="Yangi musobaqa boshlanmoqda!",
            body=f"{game_type_label} musobaqasiga taklif etilgansiz. Hoziroq qo'shiling!",
            data={"session_id": str(session.id), "game_type": session.game_type.value},
        )
        db.add(notif)

    await db.commit()

    resp = SessionResponse.model_validate(session)
    resp.teacher_name = current_user.full_name
    return resp


# ─── GET /live-sessions/{id} ─────────────────────────────────────────────────

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sessiya ma'lumotlarini olish."""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    teacher = await db.get(User, session.teacher_id)
    resp = SessionResponse.model_validate(session)
    resp.teacher_name = teacher.full_name if teacher else None
    return resp


# ─── GET /live-sessions/{id}/my-results ──────────────────────────────────────

@router.get("/{session_id}/my-results")
async def get_my_results(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Talabaning sessiya bo'yicha shaxsiy natijalari (savollar tarixi bilan)."""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    part_result = await db.execute(
        select(LiveSessionParticipant).where(
            LiveSessionParticipant.session_id == session_id,
            LiveSessionParticipant.student_id == current_user.id,
        )
    )
    participant = part_result.scalar_one_or_none()

    if not participant:
        return {"questions": [], "total_score": 0, "answers": []}

    # Savollarni correct_index bilan qaytaramiz (sessiya tugagan bo'lsa)
    questions_with_answers = []
    for idx, q in enumerate(session.questions or []):
        student_answer_record = next(
            (a for a in (participant.answers or []) if a.get("question_index") == idx),
            None,
        )
        questions_with_answers.append({
            "index": idx,
            "question_text": q.get("question_text"),
            "options": q.get("options"),
            "correct_index": q.get("correct_index"),
            "student_answer": student_answer_record.get("answer") if student_answer_record else None,
            "is_correct": student_answer_record.get("is_correct") if student_answer_record else None,
            "score": student_answer_record.get("score", 0) if student_answer_record else 0,
        })

    return {
        "questions": questions_with_answers,
        "total_score": participant.personal_score,
        "is_mvp": participant.is_mvp,
    }


# ─── POST /live-sessions/{id}/teams ──────────────────────────────────────────

@router.post("/{session_id}/teams")
async def create_teams(
    session_id: uuid.UUID,
    teams: list[dict],
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Guruhlarni belgilash. teams = [{"name": "...", "color": "#FF5733", "member_ids": [...]}]"""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    team_objects = []
    for t in teams:
        team = LiveSessionTeam(
            session_id=session_id,
            name=t["name"],
            color=t.get("color", "#3B82F6"),
        )
        db.add(team)
        await db.flush()

        for member_id in t.get("member_ids", []):
            participant = LiveSessionParticipant(
                session_id=session_id,
                student_id=uuid.UUID(str(member_id)),
                team_id=team.id,
            )
            db.add(participant)
        team_objects.append(team)

    await db.commit()
    return {"teams": [{"id": str(t.id), "name": t.name} for t in team_objects]}


# ─── POST /live-sessions/{id}/start ─────────────────────────────────────────

@router.post("/{session_id}/start")
async def start_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Musobaqani boshlash → WS broadcast session_started."""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    await db.execute(
        sql_update(LiveSession)
        .where(LiveSession.id == session_id)
        .values(status=SessionStatus.active)
    )
    await db.commit()

    await manager.broadcast(str(session_id), {
        "type": "session_started",
        "session_id": str(session_id),
    })

    # Birinchi savolni darhol yuborish
    if session.questions:
        q = session.questions[0]
        await manager.broadcast(str(session_id), {
            "type": "next_question",
            "index": 0,
            "question": {
                "question_text": q.get("question_text"),
                "options": q.get("options"),
                "time_limit_sec": session.config.get("time_limit_ms", 30000) // 1000,
            },
            "total": len(session.questions),
        })

    return {"status": "started"}


# ─── POST /live-sessions/{id}/next ──────────────────────────────────────────

@router.post("/{session_id}/next")
async def next_question(
    session_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Keyingi savolga o'tish. Savollar tugasa — sessiyani yakunlaydi."""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    new_index = (session.current_question_index or 0) + 1
    if new_index >= len(session.questions or []):
        return await end_session(session_id, current_user, db)

    await db.execute(
        sql_update(LiveSession)
        .where(LiveSession.id == session_id)
        .values(current_question_index=new_index)
    )
    await db.commit()

    question = session.questions[new_index]
    safe_question = {
        "index": new_index,
        "question_text": question.get("question_text"),
        "options": question.get("options"),
        "time_limit_sec": session.config.get("time_limit_ms", 30000) // 1000,
    }
    await manager.broadcast(str(session_id), {
        "type": "next_question",
        "index": new_index,
        "question": safe_question,
        "total": len(session.questions or []),
    })
    return {"index": new_index}


# ─── POST /live-sessions/{id}/end ────────────────────────────────────────────

@router.post("/{session_id}/end")
async def end_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Musobaqani yakunlash → MVP aniqlash → session_ended broadcast."""
    teams_result = await db.execute(
        select(LiveSessionTeam)
        .where(LiveSessionTeam.session_id == session_id)
        .order_by(LiveSessionTeam.score.desc())
    )
    teams_list = teams_result.scalars().all()

    participants_result = await db.execute(
        select(LiveSessionParticipant)
        .where(LiveSessionParticipant.session_id == session_id)
        .order_by(LiveSessionParticipant.personal_score.desc())
    )
    participants_list = participants_result.scalars().all()

    # MVP belgilash
    if participants_list:
        await db.execute(
            sql_update(LiveSessionParticipant)
            .where(LiveSessionParticipant.id == participants_list[0].id)
            .values(is_mvp=True)
        )

    await db.execute(
        sql_update(LiveSession)
        .where(LiveSession.id == session_id)
        .values(status=SessionStatus.finished)
    )
    await db.commit()

    results = {
        "type": "session_ended",
        "winner_team": teams_list[0].name if teams_list else None,
        "teams": [
            {"name": t.name, "score": t.score, "color": t.color}
            for t in teams_list
        ],
        "mvp": {
            "student_id": str(participants_list[0].student_id),
            "score": participants_list[0].personal_score,
        } if participants_list else None,
    }

    await manager.broadcast(str(session_id), results)
    return results


# ─── GET /live-sessions/{id}/results ─────────────────────────────────────────

@router.get("/{session_id}/results")
async def get_results(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Musobaqa natijalarini ko'rish."""
    teams_result = await db.execute(
        select(LiveSessionTeam)
        .where(LiveSessionTeam.session_id == session_id)
        .order_by(LiveSessionTeam.score.desc())
    )
    participants_result = await db.execute(
        select(LiveSessionParticipant)
        .where(LiveSessionParticipant.session_id == session_id)
        .order_by(LiveSessionParticipant.personal_score.desc())
    )
    teams_list = teams_result.scalars().all()
    participants_list = participants_result.scalars().all()

    return {
        "teams": [
            {"id": str(t.id), "name": t.name, "score": t.score, "color": t.color}
            for t in teams_list
        ],
        "participants": [
            {
                "student_id": str(p.student_id),
                "team_id": str(p.team_id) if p.team_id else None,
                "personal_score": p.personal_score,
                "is_mvp": p.is_mvp,
            }
            for p in participants_list
        ],
    }


# ─── WebSocket: WS /live-sessions/ws/{session_id} ────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    session_id: str,
    ws: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket orqali musobaqaga ulash.
    URL: wss://host/api/v1/live-sessions/ws/{session_id}?token=<access_token>
    """
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4001, reason="Token kerak")
        return

    try:
        from backend.core.security import decode_token
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await ws.close(code=4001, reason="Notogri token")
            return
    except Exception:
        await ws.close(code=4001, reason="Token xato")
        return

    await manager.connect(session_id, user_id, ws)

    try:
        await manager.broadcast(session_id, {
            "type": "participant_joined",
            "user_id": user_id,
            "connected_count": manager.get_connected_count(session_id),
        })

        while True:
            data = await ws.receive_json()
            await _handle_ws_message(session_id, user_id, data, db)

    except WebSocketDisconnect:
        manager.disconnect(session_id, user_id)
        await manager.broadcast(session_id, {
            "type": "participant_left",
            "user_id": user_id,
            "connected_count": manager.get_connected_count(session_id),
        })
    except Exception:
        manager.disconnect(session_id, user_id)


async def _handle_ws_message(
    session_id: str, user_id: str, data: dict, db: AsyncSession
) -> None:
    """WebSocket orqali kelgan xabarni qayta ishlash."""
    msg_type = data.get("type")

    if msg_type == "submit_answer":
        await _process_answer(session_id, user_id, data, db)
    elif msg_type == "ping":
        ws = manager.rooms[session_id].get(user_id)
        if ws:
            await ws.send_json({"type": "pong"})


async def _process_answer(
    session_id: str, user_id: str, data: dict, db: AsyncSession
) -> None:
    """Javobni qayta ishlash va ball hisoblash."""
    session = await db.get(LiveSession, uuid.UUID(session_id))
    if not session or session.status != SessionStatus.active:
        return

    questions = session.questions or []
    current_idx = session.current_question_index or 0
    if current_idx >= len(questions):
        return

    question = questions[current_idx]
    student_answer = data.get("answer")
    correct_answer = question.get("correct_index") if "correct_index" in question else question.get("correct_answer")
    is_correct = str(student_answer) == str(correct_answer)

    time_taken = data.get("time_taken_ms", 0)
    time_limit = session.config.get("time_limit_ms", 30000)
    score = 0

    if session.game_type == GameType.blitz:
        score = GameEngine.calculate_blitz_score(is_correct, time_taken, time_limit)
    elif session.game_type == GameType.relay:
        score = GameEngine.calculate_relay_score(is_correct, data.get("is_steal", False))
    elif session.game_type == GameType.lucky_card:
        score = GameEngine.calculate_lucky_card_score(
            data.get("card_type", "question"), is_correct
        )
    elif session.game_type == GameType.pyramid:
        score = GameEngine.calculate_pyramid_score(data.get("level", 0), is_correct)
    else:
        score = 10 if is_correct else 0

    # Participant topish yoki yaratish
    participant_result = await db.execute(
        select(LiveSessionParticipant).where(
            LiveSessionParticipant.session_id == uuid.UUID(session_id),
            LiveSessionParticipant.student_id == uuid.UUID(user_id),
        )
    )
    participant = participant_result.scalar_one_or_none()

    if not participant:
        participant = LiveSessionParticipant(
            session_id=uuid.UUID(session_id),
            student_id=uuid.UUID(user_id),
        )
        db.add(participant)
        await db.flush()

    # Javobni answers ro'yxatiga saqlash
    current_answers = list(participant.answers or [])
    current_answers.append({
        "question_index": current_idx,
        "answer": student_answer,
        "is_correct": is_correct,
        "score": max(0, score),
        "time_taken_ms": time_taken,
    })

    await db.execute(
        sql_update(LiveSessionParticipant)
        .where(LiveSessionParticipant.id == participant.id)
        .values(
            personal_score=LiveSessionParticipant.personal_score + max(0, score),
            answers=current_answers,
        )
    )
    if participant.team_id and score > 0:
        await db.execute(
            sql_update(LiveSessionTeam)
            .where(LiveSessionTeam.id == participant.team_id)
            .values(score=LiveSessionTeam.score + score)
        )
    await db.commit()

    # Broadcast javob natijasi
    await manager.broadcast(session_id, {
        "type": "answer_result",
        "user_id": user_id,
        "is_correct": is_correct,
        "score": score,
        "answer": student_answer,
    })

    # Leaderboard yangilash
    teams_result = await db.execute(
        select(LiveSessionTeam)
        .where(LiveSessionTeam.session_id == uuid.UUID(session_id))
        .order_by(LiveSessionTeam.score.desc())
    )
    await manager.broadcast(session_id, {
        "type": "leaderboard_update",
        "teams": [
            {"name": t.name, "score": t.score, "color": t.color}
            for t in teams_result.scalars().all()
        ],
    })


# ─── Helper: Guruhlarni avtomatik tuzish ─────────────────────────────────────

async def _auto_assign_teams(
    session: LiveSession,
    body: SessionCreate,
    db: AsyncSession,
) -> list[uuid.UUID]:
    """Sessiya turiga qarab guruhlarni avtomatik tuzadi.

    Returns: talabalar UUID ro'yxati (bildirishnoma yuborish uchun).
    """
    all_student_ids: list[uuid.UUID] = []

    if session.session_type == "class_battle":
        # Har bir sinf → alohida jamoa
        for i, class_id in enumerate(body.class_ids):
            cls = await db.get(Class, class_id)
            if not cls:
                continue

            team = LiveSessionTeam(
                session_id=session.id,
                name=cls.name,
                color=TEAM_COLORS[i % len(TEAM_COLORS)],
            )
            db.add(team)
            await db.flush()

            enrollments_result = await db.execute(
                select(ClassEnrollment).where(
                    ClassEnrollment.class_id == class_id,
                    ClassEnrollment.status == ClassEnrollmentStatus.active,
                )
            )
            for enrollment in enrollments_result.scalars().all():
                participant = LiveSessionParticipant(
                    session_id=session.id,
                    student_id=enrollment.student_id,
                    team_id=team.id,
                )
                db.add(participant)
                all_student_ids.append(enrollment.student_id)

    elif session.session_type == "group_battle" and body.class_ids:
        class_id = body.class_ids[0]
        group_count = max(2, min(body.group_count, 8))

        # Sinfning faol talabalarini olish
        enrollments_result = await db.execute(
            select(ClassEnrollment).where(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
        )
        enrollments = enrollments_result.scalars().all()
        student_ids = [e.student_id for e in enrollments]
        all_student_ids = list(student_ids)

        if body.grouping_method == "ai" and student_ids:
            # AI-asosida: o'tgan sessiyalardagi ball bo'yicha balanslangan taqsimlash
            student_scores: dict[uuid.UUID, float] = {}
            for sid in student_ids:
                score_result = await db.execute(
                    select(func.avg(LiveSessionParticipant.personal_score)).where(
                        LiveSessionParticipant.student_id == sid
                    )
                )
                avg = score_result.scalar()
                student_scores[sid] = float(avg or 0)

            # Yuqori balldan pastga saralash, keyin "ilon" tarzida guruhlarga taqsimlash
            sorted_students = sorted(student_ids, key=lambda sid: student_scores[sid], reverse=True)
        else:
            # Tasodifiy aralash
            sorted_students = list(student_ids)
            random.shuffle(sorted_students)

        # Guruhlar yaratish
        teams: list[LiveSessionTeam] = []
        for i in range(group_count):
            team = LiveSessionTeam(
                session_id=session.id,
                name=f"{i + 1}-guruh",
                color=TEAM_COLORS[i % len(TEAM_COLORS)],
            )
            db.add(team)
            teams.append(team)
        await db.flush()

        # Snake-draft taqsimlash: 1→2→3→3→2→1→1→... (balans uchun)
        for idx, sid in enumerate(sorted_students):
            # Ilon tartibida indeks hisoblash
            cycle = group_count * 2 - 2 if group_count > 1 else 1
            pos = idx % cycle
            if pos < group_count:
                team_idx = pos
            else:
                team_idx = cycle - pos
            team_idx = min(team_idx, group_count - 1)

            participant = LiveSessionParticipant(
                session_id=session.id,
                student_id=sid,
                team_id=teams[team_idx].id,
            )
            db.add(participant)

    await db.flush()
    return list(set(all_student_ids))
