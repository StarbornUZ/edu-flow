import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

# ---------------------------------------------------------------------------
# Enums (string literal — model enum bilan mos)
# ---------------------------------------------------------------------------

DIFFICULTY_VALUES = {"beginner", "intermediate", "advanced"}
STATUS_VALUES = {"draft", "published", "archived"}


# ---------------------------------------------------------------------------
# Course schemas
# ---------------------------------------------------------------------------

class CourseCreate(BaseModel):
    title: str
    description: str
    subject: str
    difficulty: str = "beginner"
    cover_url: str | None = None
    is_ai_generated: bool = False

    @field_validator("difficulty")
    @classmethod
    def difficulty_valid(cls, v: str) -> str:
        if v not in DIFFICULTY_VALUES:
            raise ValueError(f"difficulty qiymati: {DIFFICULTY_VALUES}")
        return v


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    subject: str | None = None
    difficulty: str | None = None
    cover_url: str | None = None

    @field_validator("difficulty")
    @classmethod
    def difficulty_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in DIFFICULTY_VALUES:
            raise ValueError(f"difficulty qiymati: {DIFFICULTY_VALUES}")
        return v


class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    title: str
    description: str
    subject: str
    difficulty: str
    cover_url: str | None
    is_ai_generated: bool
    is_verified: bool
    status: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Module schemas
# ---------------------------------------------------------------------------

class ModuleCreate(BaseModel):
    title: str
    content_md: str
    order_number: int
    prev_module_id: uuid.UUID | None = None
    is_published: bool = False


class ModuleUpdate(BaseModel):
    title: str | None = None
    content_md: str | None = None
    order_number: int | None = None
    is_published: bool | None = None


class ModuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    content_md: str
    order_number: int
    prev_module_id: uuid.UUID | None
    is_published: bool
    created_at: datetime
    updated_at: datetime
