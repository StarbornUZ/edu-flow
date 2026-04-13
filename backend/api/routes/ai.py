"""AI endpoints — Phase 4.

Endpointlar:
  POST /api/v1/ai/generate-course      → SSE kurs generatsiyasi (Teacher)
  POST /api/v1/ai/generate-topic       → Mavzu kontenti (Teacher)
  POST /api/v1/ai/generate-assignment  → Vazifa generatsiyasi (Teacher)
  POST /api/v1/ai/grade                → Ochiq javob baholash (Teacher)
  POST /api/v1/ai/analyze-stats        → Dashboard AI tahlil (Teacher/OrgAdmin)
  POST /api/v1/ai/split-groups         → Musobaqa uchun guruh ajratish (Teacher)

  (Legacy endpoints preserved for backwards compatibility)
  POST /api/v1/ai/courses/generate     → SSE kurs generatsiyasi (Teacher)
  POST /api/v1/ai/assignments/generate → Vazifa generatsiyasi (Teacher)
"""
from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import (
    CurrentTeacher,
    CurrentUser,
    DBSession,
    get_current_user,
    get_db,
)
from backend.db.models.user import User
from backend.services import ai_service

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CourseGenerateRequest(BaseModel):
    subject: str
    grade_level: int
    goal: str
    module_count: int = 3


class TopicGenerateRequest(BaseModel):
    topic_title: str
    subject: str
    grade_level: int


class AssignmentGenerateRequest(BaseModel):
    topic: str = ""
    subject: str = ""
    grade_level: int = 10
    question_type: str = "mcq"
    count: int = 5
    course_id: uuid.UUID | None = None  # course dan topic/subject olish uchun
    game_type: str | None = None        # frontend compat (ignored)


class GradeRequest(BaseModel):
    question: str
    model_answer: str
    student_answer: str
    max_points: int = 10
    rubric: str | None = None


class StatsAnalysisRequest(BaseModel):
    stats_data: dict


class GroupSplitRequest(BaseModel):
    class_ids: list[uuid.UUID]
    n_groups: int = 3


# ─── POST /ai/generate-course ─────────────────────────────────────────────────

@router.post(
    "/generate-course",
    summary="AI bilan kurs generatsiyasi (SSE streaming, Teacher)",
)
async def generate_course(
    body: CourseGenerateRequest,
    current_user: CurrentTeacher,
    db: DBSession,
):
    """Claude Sonnet 4.6 yordamida to'liq kurs strukturasini SSE orqali qaytaradi."""
    from backend.services.prompts.course_prompts import COURSE_GENERATION_SYSTEM, course_generation_user

    async def event_generator():
        try:
            async for chunk in ai_service.stream_claude(
                system=COURSE_GENERATION_SYSTEM,
                user_message=course_generation_user(
                    body.subject, body.grade_level, body.goal, body.module_count
                ),
                max_tokens=8000,
                db=db,
                org_id=str(current_user.org_id) if current_user.org_id else None,
                user_id=str(current_user.id),
                endpoint="generate_course",
            ):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── POST /ai/generate-course-v2 ─────────────────────────────────────────────

class CourseGenerateV2Request(BaseModel):
    subject: str
    grade_level: int
    goal: str
    module_count: int = 3
    context_text: str = ""   # ixtiyoriy: darslik/qo'llanma matni


@router.post(
    "/generate-course-v2",
    summary="Phased AI course generation — tool_use, structured SSE (Teacher)",
)
async def generate_course_v2(
    body: CourseGenerateV2Request,
    teacher: CurrentTeacher,
    db: DBSession,
):
    """
    Bosqichli kurs generatsiyasi:
      1. Modullar (tool_use bilan kafolatlangan JSON)
      2. Har modul uchun mavzular (alohida tool_use chaqiruvi)
    SSE eventlar structured JSON — raw text emas.
    """
    async def event_generator():
        try:
            async for event_json in ai_service.generate_course_structured(
                subject=ai_service.sanitize_input(body.subject),
                grade_level=body.grade_level,
                goal=ai_service.sanitize_input(body.goal),
                module_count=max(1, min(body.module_count, 8)),
                context_text=ai_service.sanitize_input(body.context_text, 5000),
            ):
                yield f"data: {event_json}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── POST /ai/generate-topic ──────────────────────────────────────────────────

@router.post("/generate-topic", summary="AI bilan mavzu kontenti yaratish (Teacher)")
async def generate_topic(
    body: TopicGenerateRequest,
    current_user: CurrentTeacher,
    db: DBSession,
):
    """Markdown formatida mavzu kontentini qaytaradi (kamida 500 so'z)."""
    content = await ai_service.generate_topic_content(
        topic_title=body.topic_title,
        subject=body.subject,
        grade_level=body.grade_level,
    )
    return {"content_md": content}


# ─── POST /ai/generate-assignment ────────────────────────────────────────────

@router.post("/generate-assignment", summary="AI bilan vazifa generatsiyasi (Teacher)")
async def generate_assignment(
    body: AssignmentGenerateRequest,
    current_user: CurrentTeacher,
    db: DBSession,
):
    """JSON formatida vazifa savollarini qaytaradi."""
    from backend.services.prompts.course_prompts import ASSIGNMENT_GENERATION_SYSTEM, assignment_generation_user

    topic = body.topic
    subject = body.subject

    # course_id berilgan bo'lsa, kursdan mavzu va fan olish
    if body.course_id and (not topic or not subject):
        from backend.db.models.course import Course
        course = await db.get(Course, body.course_id)
        if course:
            topic = topic or course.title
            subject = subject or course.subject

    topic = topic or "Umumiy mavzu"
    subject = subject or "Umumiy"

    result = await ai_service.get_json_from_claude(
        system=ASSIGNMENT_GENERATION_SYSTEM,
        user_message=assignment_generation_user(
            topic, subject, body.grade_level,
            body.question_type, body.count
        ),
        max_tokens=3000,
    )
    return result


# ─── POST /ai/grade ──────────────────────────────────────────────────────────

@router.post("/grade", summary="Ochiq javobni AI bilan baholash (Teacher)")
async def grade_answer(
    body: GradeRequest,
    current_user: CurrentTeacher,
    db: DBSession,
):
    """score, feedback, is_correct va batafsil izoh qaytaradi."""
    result = await ai_service.grade_submission(
        question=body.question,
        model_answer=body.model_answer,
        student_answer=body.student_answer,
        max_points=body.max_points,
        rubric=body.rubric,
    )
    return result


# ─── POST /ai/analyze-stats ──────────────────────────────────────────────────

@router.post("/analyze-stats", summary="Dashboard AI tahlili (Teacher/OrgAdmin)")
async def analyze_stats(
    body: StatsAnalysisRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """Statistika asosida AI insights qaytaradi."""
    analysis = await ai_service.analyze_stats(body.stats_data)
    return {"analysis": analysis}


# ─── POST /ai/split-groups ───────────────────────────────────────────────────

@router.post("/split-groups", summary="Musobaqa uchun adolatli guruh ajratish (Teacher)")
async def split_groups(
    body: GroupSplitRequest,
    current_user: CurrentTeacher,
    db: DBSession,
):
    """O'quvchilarni XP va natijalariga qarab raqobatbardosh guruhlarga bo'ladi."""
    from backend.db.models.class_ import ClassEnrollment
    from backend.db.models.user import User as UserModel

    students = []
    for class_id in body.class_ids:
        result = await db.execute(
            select(UserModel).join(
                ClassEnrollment, ClassEnrollment.student_id == UserModel.id
            ).where(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.status == "active",
            )
        )
        for student in result.scalars().all():
            students.append({
                "id": str(student.id),
                "name": student.full_name,
                "xp": getattr(student, "xp", 0),
                "level": getattr(student, "level", 1),
            })

    if len(students) < body.n_groups:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"O'quvchilar soni ({len(students)}) guruhlar sonidan ({body.n_groups}) kam",
        )

    groups = await ai_service.split_into_groups(students, body.n_groups)
    return groups


# ─── Legacy endpoints (backwards compatibility) ───────────────────────────────

# Legacy schemas for old endpoints
class _LegacyCourseRequest(BaseModel):
    subject: str
    level: int = 5
    goal: str = ""
    module_count: int = 3
    language: str = "uz"


class _LegacyAssignmentRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    question_type: str = "mcq"
    count: int = 5
    language: str = "uz"


META_PREFIX = "[META]"
DONE_SIGNAL = "[DONE]"


def _parse_meta(chunk: str) -> tuple[str, int, int] | None:
    if not chunk.startswith(META_PREFIX):
        return None
    parts = chunk[len(META_PREFIX):].split(":")
    if len(parts) != 3:
        return None
    try:
        return parts[0], int(parts[1]), int(parts[2])
    except ValueError:
        return None


async def _sse_wrapper(generator, teacher_id: uuid.UUID, endpoint: str, db):
    from backend.repositories.ai_log_repo import AILogRepository
    prompt_hash = ""
    tokens_used = 0
    response_ms = 0

    async for chunk in generator:
        if chunk == DONE_SIGNAL:
            yield f"data: {DONE_SIGNAL}\n\n"
            continue
        meta = _parse_meta(chunk)
        if meta:
            prompt_hash, tokens_used, response_ms = meta
            continue
        yield f"data: {chunk}\n\n"

    if prompt_hash:
        log_repo = AILogRepository(db)
        await log_repo.log(
            endpoint=endpoint,
            prompt_hash=prompt_hash,
            user_id=teacher_id,
            tokens_used=tokens_used,
            response_ms=response_ms,
        )


@router.post(
    "/courses/generate",
    summary="[Legacy] Kurs strukturasini AI yordamida generatsiya qilish (Teacher, SSE)",
)
async def legacy_generate_course(
    data: _LegacyCourseRequest,
    teacher: CurrentTeacher,
    db: DBSession,
):
    from backend.services.ai_service import stream_course_generation
    gen = stream_course_generation(
        subject=data.subject,
        level=data.level,
        goal=data.goal,
        module_count=data.module_count,
        language=data.language,
    )
    return StreamingResponse(
        _sse_wrapper(gen, teacher.id, "course_generation", db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/assignments/generate",
    summary="[Legacy] Vazifa savollarini AI yordamida generatsiya qilish (Teacher, SSE)",
)
async def legacy_generate_assignment(
    data: _LegacyAssignmentRequest,
    teacher: CurrentTeacher,
    db: DBSession,
):
    from backend.services.ai_service import stream_assignment_generation
    gen = stream_assignment_generation(
        topic=data.topic,
        difficulty=data.difficulty,
        question_type=data.question_type,
        count=data.count,
        language=data.language,
    )
    return StreamingResponse(
        _sse_wrapper(gen, teacher.id, "assignment_generation", db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
