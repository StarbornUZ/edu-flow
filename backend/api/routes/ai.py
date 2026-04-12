"""AI generatsiya endpointlari — SSE streaming orqali.

Asosiy model: GPT-4o | Zaxira: Claude Sonnet

Endpointlar:
  POST /api/v1/ai/courses/generate      → kurs strukturasini generatsiya qilish (Teacher)
  POST /api/v1/ai/assignments/generate  → vazifa savollarini generatsiya qilish (Teacher)

Qo'llab-quvvatlanadigan tillar:
  "uz" — O'zbek (standart)
  "ru" — Rus tili
  "en" — Ingliz tili
"""
import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.api.deps import CurrentTeacher, DBSession
from backend.repositories.ai_log_repo import AILogRepository
from backend.services.ai_service import (
    stream_assignment_generation,
    stream_course_generation,
)
from backend.schemas.ai import CourseGenerateRequest, AssignmentGenerateRequest

router = APIRouter()

# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

META_PREFIX = "[META]"
DONE_SIGNAL = "[DONE]"


def _parse_meta(chunk: str) -> tuple[str, int, int] | None:
    """[META]hash:tokens:ms — ni parse qiladi."""
    if not chunk.startswith(META_PREFIX):
        return None
    parts = chunk[len(META_PREFIX):].split(":")
    if len(parts) != 3:
        return None
    try:
        return parts[0], int(parts[1]), int(parts[2])
    except ValueError:
        return None


async def _sse_wrapper(
        generator,
        teacher_id: uuid.UUID,
        endpoint: str,
        db: DBSession,
):
    """Stream generatorni SSE formatga o'giradi va AILog yozadi."""
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

    # Stream tugagach — AILog yoziladi
    if prompt_hash:
        log_repo = AILogRepository(db)
        await log_repo.log(
            endpoint=endpoint,
            prompt_hash=prompt_hash,
            user_id=teacher_id,
            tokens_used=tokens_used,
            response_ms=response_ms,
        )


# ---------------------------------------------------------------------------
# POST /ai/courses/generate
# ---------------------------------------------------------------------------

@router.post(
    "/courses/generate",
    summary="Kurs strukturasini AI yordamida generatsiya qilish (Teacher, SSE)",
    description="""
**GPT-4o** (asosiy) yoki **Claude Sonnet** (zaxira) yordamida kurs strukturasini
Server-Sent Events (SSE) formatida qaytaradi.

**Frontend ulashish:**
```js
const resp = await fetch('/api/v1/ai/courses/generate', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ...'},
  body: JSON.stringify({subject, level, goal, module_count, language}),
});
const reader = resp.body.getReader();
// chunklarni o'qing, "[DONE]" — stream tugadi
```
""",
)
async def generate_course(
        data: CourseGenerateRequest,
        teacher: CurrentTeacher,
        db: DBSession,
):
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
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# POST /ai/assignments/generate
# ---------------------------------------------------------------------------

@router.post(
    "/assignments/generate",
    summary="Vazifa savollarini AI yordamida generatsiya qilish (Teacher, SSE)",
    description="""
**GPT-4o** (asosiy) yoki **Claude Sonnet** (zaxira) yordamida vazifa savollarini
SSE formatida qaytaradi.

`language` parametri yordamida savollar tanlangan tilda (uz/ru/en) generatsiya qilinadi.
""",
)
async def generate_assignment(
        data: AssignmentGenerateRequest,
        teacher: CurrentTeacher,
        db: DBSession,
):
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
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
