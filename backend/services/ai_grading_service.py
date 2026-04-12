"""AI bilan baholash servisi.

Deterministik grading ishlamagan *barcha* savollar uchun yagona nuqta:
  - open_answer → har doim AI baholaydi
  - fill        → correct_answer_json bo'sh/None bo'lganda AI baholaydi

Foydalanish (BackgroundTasks):
    from backend.services.ai_grading_service import PendingGradeItem, grade_pending_results

    items = [PendingGradeItem(...), ...]
    background_tasks.add_task(grade_pending_results, submission_id, items)

BackgroundTasks bilan ishlash uchun yangi DB session ichkarida ochiladi
(request sessiyasidan mustaqil).
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field

from backend.db.models.submission import SubmissionStatus
from backend.db.session import get_session_factory
from backend.repositories.ai_log_repo import AILogRepository
from backend.repositories.assignment_repo import AssignmentRepository
from backend.services.ai_service import Language, grade_open_answer, make_prompt_hash


# ---------------------------------------------------------------------------
# Item tuzilmasi
# ---------------------------------------------------------------------------

@dataclass
class PendingGradeItem:
    """AI baholash uchun bitta savol ma'lumotlari.

    question_type: "open_answer" | "fill" (yoki boshqa kelajakdagi tiplar)
    model_answer:  open_answer → correct_answer_json matni
                   fill (None bo'lganda) → "" (AI o'zi kontekst bo'yicha baholaydi)
    """
    result_id:     uuid.UUID
    question_text: str
    student_answer: str
    max_pts:       float
    question_type: str
    model_answer:  str      = field(default="")
    language:      Language = field(default="uz")


# ---------------------------------------------------------------------------
# Asosiy background funksiya
# ---------------------------------------------------------------------------

async def grade_pending_results(
    submission_id: uuid.UUID,
    items: list[PendingGradeItem],
) -> None:
    """Pending savollarni AI bilan baholaydi va DB ni yangilaydi.

    - Har bir item uchun grade_open_answer() chaqiriladi
    - SubmissionResult.ai_score / is_correct / ai_feedback / xp_earned yangilanadi
    - AILog yoziladi
    - Barcha pending tugagach Submission.status → ai_reviewed
    """
    async with get_session_factory()() as bg_db:
        repo     = AssignmentRepository(bg_db)
        log_repo = AILogRepository(bg_db)

        for item in items:
            result = await repo.get_result(item.result_id)
            if result is None:
                continue

            start_ms = int(time.time() * 1000)

            graded = await grade_open_answer(
                question_text=item.question_text,
                model_answer=item.model_answer,
                student_answer=item.student_answer,
                max_points=item.max_pts,
                language=item.language,
            )

            result.ai_score    = graded.score
            result.is_correct  = graded.is_correct
            result.ai_feedback = graded.feedback
            result.xp_earned   = graded.xp_earned

            elapsed_ms = int(time.time() * 1000) - start_ms
            await log_repo.log(
                endpoint="grading",
                prompt_hash=make_prompt_hash(
                    f"{item.question_text}|{item.model_answer}|{item.student_answer}"
                ),
                response_ms=elapsed_ms,
            )

        await bg_db.commit()

        # Barcha natijalar AI tomonidan baholangan bo'lsa — status yangilash
        submission = await repo.get_submission(submission_id)
        if submission:
            all_results  = await repo.get_results(submission_id)
            still_pending = any(r.is_correct is None for r in all_results)
            if not still_pending:
                await repo.update_submission_status(
                    submission, SubmissionStatus.ai_reviewed
                )
