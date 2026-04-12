from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["uz", "ru", "en"]


class CourseGenerateRequest(BaseModel):
    subject: str = Field(..., min_length=2, max_length=200, description="Kurs fani / предмет / subject")
    level: str = Field(..., description="Daraja / уровень / level")
    goal: str = Field(..., min_length=5, max_length=500, description="O'quv maqsadi / цель / goal")
    module_count: int = Field(default=5, ge=1, le=15)
    language: Language = Field(default="uz", description="Kurs tili: uz | ru | en")


class AssignmentGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    difficulty: str = Field(default="intermediate", description="beginner | intermediate | advanced")
    question_type: str = Field(default="mcq", description="mcq | fill | matching | ordering | open_answer | timed")
    count: int = Field(default=5, ge=1, le=20)
    language: Language = Field(default="uz", description="Savol tili: uz | ru | en")
