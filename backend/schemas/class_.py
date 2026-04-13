import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, computed_field, field_validator


# ---------------------------------------------------------------------------
# Class schemas
# ---------------------------------------------------------------------------

class ClassCreate(BaseModel):
    name: str
    academic_year: str  # "2025-2026"
    org_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None
    grade_level: int | None = None


class ClassUpdate(BaseModel):
    name: str | None = None
    academic_year: str | None = None
    grade_level: int | None = None


class ClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID | None
    name: str
    academic_year: str
    class_code: str
    class_code_expires_at: datetime
    org_id: uuid.UUID | None = None
    grade_level: int | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[misc]
    @property
    def class_code_active(self) -> bool:
        """Frontend uchun qulay flag: kod hali aktiv."""
        return self.class_code_expires_at > datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enrollment schemas
# ---------------------------------------------------------------------------

class JoinClassRequest(BaseModel):
    class_code: str

    @field_validator("class_code")
    @classmethod
    def code_uppercase(cls, v: str) -> str:
        return v.strip().upper()


class EnrollCourseRequest(BaseModel):
    """Teacher kursni butun sinfga biriktirish uchun."""
    course_id: uuid.UUID
    deadline: datetime | None = None  # ixtiyoriy muddat


class ClassEnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    created_at: datetime


class ClassStudentResponse(BaseModel):
    enrollment_id: uuid.UUID
    student_id: uuid.UUID
    full_name: str
    email: str
    username: str | None
    phone: str | None
    avatar_url: str | None
    status: str
    enrolled_at: datetime
