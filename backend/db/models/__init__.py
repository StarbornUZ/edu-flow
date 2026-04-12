# Barcha modellarni bir joydan import qilish.
# Alembic autogenerate uchun bu fayl import qilinishi shart.

from backend.db.models.user import User, UserRole
from backend.db.models.course import (
    Course,
    CourseModule,
    CourseEnrollment,
    CourseStatus,
    CourseDifficulty,
)
from backend.db.models.class_ import Class, ClassEnrollment, ClassEnrollmentStatus
from backend.db.models.assignment import Assignment, Question, QuestionType
from backend.db.models.refresh_session import RefreshSession
from backend.db.models.submission import (
    Submission,
    SubmissionResult,
    SubmissionStatus,
    UserProgress,
    Achievement,
    AILog,
)

__all__ = [
    # User
    "User",
    "UserRole",
    # Course
    "Course",
    "CourseModule",
    "CourseEnrollment",
    "CourseStatus",
    "CourseDifficulty",
    # Class
    "Class",
    "ClassEnrollment",
    "ClassEnrollmentStatus",
    # Assignment
    "Assignment",
    "Question",
    "QuestionType",
    # Submission
    "Submission",
    "SubmissionResult",
    "SubmissionStatus",
    "UserProgress",
    "Achievement",
    "AILog",
    # RefreshSession
    "RefreshSession"
]
