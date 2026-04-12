"""Live Sessions — WebSocket + REST endpoints.

REST:
  POST   /api/v1/live-sessions/                → sessiya yaratish (Teacher)
  POST   /api/v1/live-sessions/{id}/teams      → guruhlarni belgilash (Teacher)
  POST   /api/v1/live-sessions/{id}/start      → boshlash (Teacher)
  POST   /api/v1/live-sessions/{id}/next       → keyingi savol (Teacher)
  POST   /api/v1/live-sessions/{id}/end        → yakunlash (Teacher)
  GET    /api/v1/live-sessions/{id}/results    → natijalar (barcha)

WebSocket:
  WS     /api/v1/live-sessions/ws/{id}?token=  → musobaqaga ulash
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db, get_current_user, CurrentTeacher, CurrentUser, DBSession, _require_teacher_or_admin as require_teacher
from backend.db.models.live_session import (
    GameType,
    LiveSession,
    LiveSessionParticipant,
    LiveSessionTeam,
    SessionStatus,
)
from backend.db.models.user import User
from backend.services.live_session_service import GameEngine, manager

router = APIRouter(prefix="/live-sessions", tags=["live-sessions"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    game_type: GameType
    course_id: uuid.UUID | None = None
    config: dict = {}
    questions: list[dict] = []


class SessionResponse(BaseModel):
    id: uuid.UUID
    game_type: str
    status: str
    config: dict
    model_config = {"from_attributes": True}


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
        config=body.config,
        questions=body.questions,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


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
    # options va correct_index ni student ga yubormaymiz (xavfsizlik)
    safe_question = {
        "index": new_index,
        "question": question.get("question"),
        "options": question.get("options"),
        "time_limit_sec": question.get("time_limit_sec", 30),
    }
    await manager.broadcast(str(session_id), {
        "type": "next_question",
        "index": new_index,
        "question": safe_question,
        "total": len(session.questions),
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

    # Participant score yangilash
    participant_result = await db.execute(
        select(LiveSessionParticipant).where(
            LiveSessionParticipant.session_id == uuid.UUID(session_id),
            LiveSessionParticipant.student_id == uuid.UUID(user_id),
        )
    )
    participant = participant_result.scalar_one_or_none()

    if participant:
        await db.execute(
            sql_update(LiveSessionParticipant)
            .where(LiveSessionParticipant.id == participant.id)
            .values(personal_score=LiveSessionParticipant.personal_score + max(0, score))
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
