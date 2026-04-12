"""Dashboard response schemalari."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


# ----------------------------------------------------------------
# TEACHER DASHBOARD
# ----------------------------------------------------------------

class ClassStatResponse(BaseModel):
    class_id: uuid.UUID
    name: str
    subject: str
    academic_year: str
    student_count: int
    active_assignments: int

    model_config = ConfigDict(from_attributes=True)


class PendingReviewResponse(BaseModel):
    submission_id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    attempt_num: int
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProblemQuestionResponse(BaseModel):
    question_id: uuid.UUID
    question_text: str
    total_attempts: int
    error_rate: float   # 0.0–1.0


class TeacherDashboardResponse(BaseModel):
    classes: list[ClassStatResponse]
    pending_reviews: list[PendingReviewResponse]
    pending_count: int
    problem_questions: list[ProblemQuestionResponse]


# ----------------------------------------------------------------
# STUDENT DASHBOARD
# ----------------------------------------------------------------

class ActiveCourseResponse(BaseModel):
    course_id: uuid.UUID
    title: str
    subject: str
    difficulty: str
    cover_url: str | None
    completed_modules: int

    model_config = ConfigDict(from_attributes=True)


class AchievementResponse(BaseModel):
    badge_type: str
    metadata: Any
    earned_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentDashboardResponse(BaseModel):
    # Gamification
    xp: int
    level: int
    streak_count: int
    streak_last_date: str | None   # "2026-04-11" yoki null

    # Kurslar
    active_courses: list[ActiveCourseResponse]
    active_courses_count: int

    # Achievementlar
    recent_achievements: list[AchievementResponse]


# ----------------------------------------------------------------
# Gamification event (submit javobi bilan birga qaytariladi)
# ----------------------------------------------------------------

class GamificationResult(BaseModel):
    xp_earned: int
    new_level: int | None        # None = daraja o'zgarmagan
    new_badges: list[str]        # ["streak_7", "level_3"] yoki []
