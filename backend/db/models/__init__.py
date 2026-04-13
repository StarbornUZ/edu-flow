# Barcha modellarni bir joydan import qilish.
# Alembic autogenerate uchun bu fayl import qilinishi shart.

from backend.db.models.user import User, UserRole
from backend.db.models.organization import (
    Organization,
    OrganizationMember,
    OrganizationRequest,
    OrgType,
    OrgPlan,
    OrgStatus,
    OrgMemberRole,
    OrganizationRequestStatus,
)
from backend.db.models.subject import Subject
from backend.db.models.topic import Topic
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
from backend.db.models.live_session import (
    LiveSession,
    LiveSessionTeam,
    LiveSessionParticipant,
    GameType,
    SessionStatus,
)
from backend.db.models.badge import Badge, StudentBadge
from backend.db.models.parent_student import ParentStudent
from backend.db.models.org_invitation import OrgInvitation, InvitationStatus
from backend.db.models.notification import Notification

__all__ = [
    # User
    "User",
    "UserRole",
    # Organization
    "Organization",
    "OrganizationMember",
    "OrganizationRequest",
    "OrgType",
    "OrgPlan",
    "OrgStatus",
    "OrgMemberRole",
    "OrganizationRequestStatus",
    # Subject
    "Subject",
    # Topic
    "Topic",
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
    "RefreshSession",
    # LiveSession
    "LiveSession",
    "LiveSessionTeam",
    "LiveSessionParticipant",
    "GameType",
    "SessionStatus",
    # Badge
    "Badge",
    "StudentBadge",
    # ParentStudent
    "ParentStudent",
    # OrgInvitation
    "OrgInvitation",
    "InvitationStatus",
    # Notification
    "Notification",
]
