import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, computed_field, field_validator


# ---------------------------------------------------------------------------
# Class schemas
# ---------------------------------------------------------------------------

class ClassCreate(BaseModel):
    name: str
    subject: str
    academic_year: str  # "2025-2026"


class ClassUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    academic_year: str | None = None


class ClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    name: str
    subject: str
    academic_year: str
    class_code: str
    class_code_expires_at: datetime
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
