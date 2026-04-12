import uuid
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.assignment import Assignment, Question
from backend.db.models.submission import Submission, SubmissionResult, SubmissionStatus


class AssignmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Assignment
    # ------------------------------------------------------------------

    async def create(self, teacher_id: uuid.UUID, questions_data: list[dict], **data) -> Assignment:
        assignment = Assignment(teacher_id=teacher_id, **data)
        self.db.add(assignment)
        await self.db.flush()   # id olish uchun (commit qilmasdan)

        for q in questions_data:
            self.db.add(Question(assignment_id=assignment.id, **q))

        await self.db.commit()
        await self.db.refresh(assignment)
        return assignment

    async def get_by_id(self, assignment_id: uuid.UUID) -> Assignment | None:
        result = await self.db.execute(
            select(Assignment).where(Assignment.id == assignment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_course(self, course_id: uuid.UUID) -> Sequence[Assignment]:
        result = await self.db.execute(
            select(Assignment).where(Assignment.course_id == course_id)
                              .order_by(Assignment.created_at.desc())
        )
        return result.scalars().all()

    # ------------------------------------------------------------------
    # Questions
    # ------------------------------------------------------------------

    async def get_questions(self, assignment_id: uuid.UUID) -> Sequence[Question]:
        result = await self.db.execute(
            select(Question).where(Question.assignment_id == assignment_id)
                            .order_by(Question.order_number)
        )
        return result.scalars().all()

    async def get_question(self, question_id: uuid.UUID) -> Question | None:
        result = await self.db.execute(
            select(Question).where(Question.id == question_id)
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Submissions
    # ------------------------------------------------------------------

    async def get_attempt_count(self, assignment_id: uuid.UUID, student_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(Submission).where(
                Submission.assignment_id == assignment_id,
                Submission.student_id == student_id,
            )
        )
        return len(result.scalars().all())

    async def create_submission(
        self,
        assignment_id: uuid.UUID,
        student_id: uuid.UUID,
        answers_json: Any,
        attempt_num: int,
    ) -> Submission:
        submission = Submission(
            assignment_id=assignment_id,
            student_id=student_id,
            answers_json=answers_json,
            attempt_num=attempt_num,
            status=SubmissionStatus.pending,
        )
        self.db.add(submission)
        await self.db.flush()
        return submission

    async def get_submission(self, submission_id: uuid.UUID) -> Submission | None:
        result = await self.db.execute(
            select(Submission).where(Submission.id == submission_id)
        )
        return result.scalar_one_or_none()

    async def get_student_submissions(
        self, assignment_id: uuid.UUID, student_id: uuid.UUID
    ) -> Sequence[Submission]:
        result = await self.db.execute(
            select(Submission).where(
                Submission.assignment_id == assignment_id,
                Submission.student_id == student_id,
            ).order_by(Submission.created_at.desc())
        )
        return result.scalars().all()

    async def get_all_submissions(self, assignment_id: uuid.UUID) -> Sequence[Submission]:
        result = await self.db.execute(
            select(Submission).where(Submission.assignment_id == assignment_id)
                              .order_by(Submission.student_id, Submission.created_at.desc())
        )
        return result.scalars().all()

    # ------------------------------------------------------------------
    # Submission Results
    # ------------------------------------------------------------------

    async def create_result(
        self,
        submission_id: uuid.UUID,
        question_id: uuid.UUID,
        student_answer: Any,
        is_correct: bool | None,
        ai_score: float | None,
        xp_earned: int = 0,
        ai_feedback: str | None = None,
    ) -> SubmissionResult:
        result = SubmissionResult(
            submission_id=submission_id,
            question_id=question_id,
            student_answer=student_answer,
            is_correct=is_correct,
            ai_score=ai_score,
            xp_earned=xp_earned,
            ai_feedback=ai_feedback,
        )
        self.db.add(result)
        await self.db.flush()   # id olish uchun
        return result

    async def get_results(self, submission_id: uuid.UUID) -> Sequence[SubmissionResult]:
        result = await self.db.execute(
            select(SubmissionResult).where(SubmissionResult.submission_id == submission_id)
        )
        return result.scalars().all()

    async def get_result(self, result_id: uuid.UUID) -> SubmissionResult | None:
        result = await self.db.execute(
            select(SubmissionResult).where(SubmissionResult.id == result_id)
        )
        return result.scalar_one_or_none()

    async def confirm_result(
        self,
        result: SubmissionResult,
        teacher_score: float,
        teacher_note: str | None,
    ) -> SubmissionResult:
        result.teacher_score = teacher_score
        result.teacher_note = teacher_note
        result.is_correct = teacher_score > 0
        await self.db.commit()
        await self.db.refresh(result)
        return result

    async def update_submission_status(
        self, submission: Submission, new_status: SubmissionStatus
    ) -> Submission:
        submission.status = new_status
        await self.db.commit()
        await self.db.refresh(submission)
        return submission

    async def commit(self) -> None:
        await self.db.commit()
