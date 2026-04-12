import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

QUESTION_TYPES = {"mcq", "fill", "matching", "ordering", "open_answer", "timed"}


# ---------------------------------------------------------------------------
# Question schemas
# ---------------------------------------------------------------------------

class QuestionCreate(BaseModel):
    """Barcha 6 format uchun umumiy sxema.

    options_json / correct_answer_json format — question_type ga qarab:

    mcq:
      options_json      = ["A variant", "B variant", "C variant"]
      correct_answer_json = 0  (index)

    fill:
      options_json      = null
      correct_answer_json = ["to'g'ri javob", "qabul qilinuvchi variant"]

    matching:
      options_json      = {"left": ["A","B","C"], "right": ["1","2","3"]}
      correct_answer_json = {"A":"1", "B":"2", "C":"3"}

    ordering:
      options_json      = ["3-qadam", "1-qadam", "2-qadam"]  (aralashtirilgan)
      correct_answer_json = [1, 2, 0]  (to'g'ri tartib indekslari)

    open_answer:
      options_json      = null
      correct_answer_json = "namunaviy javob"  (AI baholash uchun etalon)

    timed:  (mcq/fill ning vaqt chegaralangan ko'rinishi)
      options_json      = [...] (mcq kabi)
      correct_answer_json = 0
    """
    question_text: str
    question_type: str
    options_json: Any = None
    correct_answer_json: Any = None
    rubric_json: Any = None        # open_answer baholash mezonlari
    order_number: int
    explanation: str | None = None # javobdan keyin ko'rinadigan tushuntirish
    points_max: float = 1.0

    @field_validator("question_type")
    @classmethod
    def type_valid(cls, v: str) -> str:
        if v not in QUESTION_TYPES:
            raise ValueError(f"question_type qiymatlari: {QUESTION_TYPES}")
        return v


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    question_text: str
    question_type: str
    options_json: Any
    order_number: int
    explanation: str | None
    points_max: float
    # correct_answer_json va rubric_json response da YO'Q — student ko'rmasin
    created_at: datetime


class QuestionResponseWithAnswer(QuestionResponse):
    """Faqat teacher uchun — to'g'ri javoblar ham keladi."""
    correct_answer_json: Any
    rubric_json: Any


# ---------------------------------------------------------------------------
# Assignment schemas
# ---------------------------------------------------------------------------

class AssignmentCreate(BaseModel):
    course_id: uuid.UUID
    module_id: uuid.UUID | None = None
    title: str
    instructions: str
    question_type: str       # assignment darajasida umumiy tur
    time_limit_sec: int | None = None   # timed uchun
    max_attempts: int = 1
    deadline: datetime | None = None
    is_ai_generated: bool = False
    questions: list[QuestionCreate]

    @field_validator("question_type")
    @classmethod
    def type_valid(cls, v: str) -> str:
        if v not in QUESTION_TYPES:
            raise ValueError(f"question_type qiymatlari: {QUESTION_TYPES}")
        return v

    @field_validator("questions")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("Kamida 1 ta savol bo'lishi kerak")
        return v


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    course_id: uuid.UUID
    module_id: uuid.UUID | None
    teacher_id: uuid.UUID
    title: str
    instructions: str
    question_type: str
    time_limit_sec: int | None
    max_attempts: int
    deadline: datetime | None
    is_ai_generated: bool
    created_at: datetime
    updated_at: datetime


class AssignmentDetailResponse(AssignmentResponse):
    """Assignment + savollar (student uchun — to'g'ri javobsiz)."""
    questions: list[QuestionResponse] = []


class AssignmentDetailTeacherResponse(AssignmentResponse):
    """Assignment + savollar + to'g'ri javoblar (faqat teacher)."""
    questions: list[QuestionResponseWithAnswer] = []


# ---------------------------------------------------------------------------
# Submit schemas
# ---------------------------------------------------------------------------

class AnswerItem(BaseModel):
    question_id: uuid.UUID
    answer: Any   # mcq→int, fill→str, matching→dict, ordering→list, open→str


class SubmitRequest(BaseModel):
    answers: list[AnswerItem]

    @field_validator("answers")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("Kamida 1 ta javob bo'lishi kerak")
        return v


# ---------------------------------------------------------------------------
# Submission / Result schemas
# ---------------------------------------------------------------------------

class SubmissionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    student_answer: Any
    is_correct: bool | None
    ai_score: float | None
    ai_feedback: str | None
    teacher_score: float | None
    teacher_note: str | None
    xp_earned: int | None


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    attempt_num: int
    status: str
    submitted_at: datetime
    results: list[SubmissionResultResponse] = []

    @field_validator("submitted_at", mode="before")
    @classmethod
    def use_created_at(cls, v):
        return v


# ---------------------------------------------------------------------------
# Teacher confirm (open_answer)
# ---------------------------------------------------------------------------

class ConfirmRequest(BaseModel):
    teacher_score: float
    teacher_note: str | None = None
