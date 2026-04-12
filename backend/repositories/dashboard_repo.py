"""Dashboard uchun aggregate query'lar.

Teacher dashboard:
  - Sinflari: o'quvchi soni + aktiv vazifalar
  - Pending reviews: AI tekshirgan lekin teacher tasdiqlamagan
  - Muammoli savollar: xato darajasi yuqori

Student dashboard:
  - Aktiv kurslar + progress
  - So'nggi achievementlar
  - XP, level, streak
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import sqlalchemy
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.assignment import Assignment, Question
from backend.db.models.class_ import Class, ClassEnrollment, ClassEnrollmentStatus
from backend.db.models.course import Course, CourseEnrollment
from backend.db.models.submission import (
    Achievement,
    Submission,
    SubmissionResult,
    SubmissionStatus,
)
from backend.db.models.user import User


class DashboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ----------------------------------------------------------------
    # TEACHER DASHBOARD
    # ----------------------------------------------------------------

    async def get_teacher_classes_stats(self, teacher_id: uuid.UUID) -> list[dict]:
        """Har bir sinf uchun: student soni, aktiv vazifalar."""
        classes_res = await self.db.execute(
            select(Class).where(Class.teacher_id == teacher_id)
        )
        classes = classes_res.scalars().all()

        result = []
        for cls in classes:
            # Student soni
            student_count_res = await self.db.execute(
                select(func.count(ClassEnrollment.id)).where(
                    ClassEnrollment.class_id == cls.id,
                    ClassEnrollment.status == ClassEnrollmentStatus.active,
                )
            )
            student_count = student_count_res.scalar() or 0

            # Aktiv vazifalar (deadline o'tmagan yoki deadline yo'q)
            now = datetime.now(timezone.utc)
            active_assignments_res = await self.db.execute(
                select(func.count(Assignment.id)).where(
                    Assignment.teacher_id == teacher_id,
                    (Assignment.deadline == None) | (Assignment.deadline > now),  # noqa: E711
                )
            )
            active_assignments = active_assignments_res.scalar() or 0

            result.append({
                "class_id": cls.id,
                "name": cls.name,
                "subject": cls.subject,
                "academic_year": cls.academic_year,
                "student_count": student_count,
                "active_assignments": active_assignments,
            })
        return result

    async def get_pending_reviews(self, teacher_id: uuid.UUID) -> list[dict]:
        """AI tekshirgan lekin teacher hali tasdiqlamagan submissionlar."""
        res = await self.db.execute(
            select(Submission, User)
            .join(Assignment, Submission.assignment_id == Assignment.id)
            .join(User, Submission.student_id == User.id)
            .where(
                Assignment.teacher_id == teacher_id,
                Submission.status == SubmissionStatus.ai_reviewed,
            )
            .order_by(Submission.created_at.desc())
            .limit(20)
        )
        rows = res.all()
        return [
            {
                "submission_id": sub.id,
                "assignment_id": sub.assignment_id,
                "student_id": student.id,
                "student_name": student.full_name,
                "attempt_num": sub.attempt_num,
                "submitted_at": sub.created_at,
            }
            for sub, student in rows
        ]

    async def get_problem_questions(self, teacher_id: uuid.UUID) -> list[dict]:
        """Xato darajasi 60% dan yuqori savollar."""
        # Har bir question uchun: total attempts, wrong count
        res = await self.db.execute(
            select(
                Question.id,
                Question.question_text,
                func.count(SubmissionResult.id).label("total"),
                func.sum(
                    func.cast(SubmissionResult.is_correct == False, sqlalchemy.Integer)
                ).label("wrong"),
            )
            .join(Assignment, Question.assignment_id == Assignment.id)
            .join(SubmissionResult, SubmissionResult.question_id == Question.id)
            .where(
                Assignment.teacher_id == teacher_id,
                SubmissionResult.is_correct.is_not(None),
            )
            .group_by(Question.id, Question.question_text)
            .having(func.count(SubmissionResult.id) >= 3)  # kamida 3 urinish
        )
        rows = res.all()

        result = []
        for row in rows:
            total = row.total or 0
            wrong = int(row.wrong or 0)
            if total > 0:
                error_rate = round(wrong / total, 2)
                if error_rate >= 0.6:
                    result.append({
                        "question_id": row.id,
                        "question_text": str(row.question_text)[:100],
                        "total_attempts": total,
                        "error_rate": error_rate,
                    })

        return sorted(result, key=lambda x: x["error_rate"], reverse=True)[:10]

    # ----------------------------------------------------------------
    # STUDENT DASHBOARD
    # ----------------------------------------------------------------

    async def get_student_active_courses(self, student_id: uuid.UUID) -> list[dict]:
        """O'quvchi yozilgan, published kurslar + progress."""
        # Direct enrollments
        direct = await self.db.execute(
            select(Course)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .where(
                CourseEnrollment.student_id == student_id,
                Course.status == "published",
            )
        )
        courses_direct = direct.scalars().all()

        # Class-based enrollments
        class_ids_res = await self.db.execute(
            select(ClassEnrollment.class_id).where(
                ClassEnrollment.student_id == student_id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
        )
        class_ids = class_ids_res.scalars().all()

        courses_via_class = []
        if class_ids:
            class_courses_res = await self.db.execute(
                select(Course)
                .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
                .where(
                    CourseEnrollment.class_id.in_(class_ids),
                    CourseEnrollment.student_id.is_(None),
                    Course.status == "published",
                )
            )
            courses_via_class = class_courses_res.scalars().all()

        # Birlashtirish (duplicate ID'lar olib tashlash)
        seen = set()
        all_courses = []
        for c in list(courses_direct) + list(courses_via_class):
            if c.id not in seen:
                seen.add(c.id)
                all_courses.append(c)

        from backend.db.models.submission import UserProgress

        result = []
        for course in all_courses:
            # Tugatilgan modullar soni (UserProgress)
            completed_res = await self.db.execute(
                select(func.count(UserProgress.id)).where(
                    UserProgress.user_id == student_id,
                    UserProgress.course_id == course.id,
                )
            )
            completed = completed_res.scalar() or 0

            result.append({
                "course_id": course.id,
                "title": course.title,
                "subject": course.subject,
                "difficulty": course.difficulty,
                "cover_url": course.cover_url,
                "completed_modules": completed,
            })
        return result

    async def get_recent_achievements(self, student_id: uuid.UUID) -> list[dict]:
        """So'nggi 5 achievement."""
        res = await self.db.execute(
            select(Achievement)
            .where(Achievement.user_id == student_id)
            .order_by(Achievement.created_at.desc())
            .limit(5)
        )
        achievements = res.scalars().all()
        return [
            {
                "badge_type": a.badge_type,
                "metadata": a.metadata_json,
                "earned_at": a.created_at,
            }
            for a in achievements
        ]
