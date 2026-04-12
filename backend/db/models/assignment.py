import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import UUID, DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class QuestionType(str, enum.Enum):
    mcq = "mcq"                # Ko'p tanlov
    fill = "fill"              # Bo'shliq to'ldirish
    matching = "matching"      # Juftlashtirish
    ordering = "ordering"      # Tartibga solishtirish
    open_answer = "open_answer"  # Ochiq savol
    timed = "timed"            # Vaqtli musobaqa (MCQ + taymer)


class Assignment(Base, TimestampMixin):
    """Vazifa — o'qituvchi yaratgan, o'quvchilar yechadigan topshiriq."""
    __tablename__ = "assignments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_modules.id", ondelete="SET NULL"),
        nullable=True,
    )

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    instructions: Mapped[str | None] = mapped_column(
        Text(),
        nullable=True,
    )

    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType, name="question_type"),
        nullable=False,
    )

    # Vaqtli musobaqa uchun: soniyalarda. Boshqa formatlarda NULL.
    time_limit_sec: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    # 0 = cheksiz urinish
    max_attempts: Mapped[int] = mapped_column(
        default=3,
        nullable=False,
    )

    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_ai_generated: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # O'qituvchi AI yaratgan vazifani tekshirib tasdiqladi
    is_verified: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # --- Relationships ---
    questions: Mapped[list["Question"]] = relationship(
        "Question",
        back_populates="assignment",
        lazy="select",
        order_by="Question.order_number",
    )
    submissions: Mapped[list["Submission"]] = relationship(  # type: ignore[name-defined]
        "Submission",
        back_populates="assignment",
        lazy="select",
    )


class Question(Base, TimestampMixin):
    """Savol — Assignment ichidagi individual savol.

    Har xil format uchun options_json va correct_answer_json tuzilmasi:
    - MCQ:      options_json=[str, str, str, str], correct_answer_json={"index": 0}
    - Fill:     options_json=null, correct_answer_json={"blanks": [["answer1", "alt"]]}
    - Matching: options_json={"pairs": [{left, right}]}, correct_answer_json={"pairs": [...]}
    - Ordering: options_json={"items": [str]}, correct_answer_json={"order": [int]}
    - Open:     options_json=null, correct_answer_json={"model_answer": str}
    - Timed:    MCQ kabi (vaqt limiti Assignment darajasida)
    """
    __tablename__ = "questions"

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    question_text: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
    )

    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType, name="question_type"),
        nullable=False,
    )

    # Format bo'yicha tuzilma yuqorida izohlangan
    options_json: Mapped[Any] = mapped_column(
        JSON(),
        nullable=True,
    )

    correct_answer_json: Mapped[Any] = mapped_column(
        JSON(),
        nullable=False,
    )

    # Ochiq savol uchun baholash rubrikasi
    # {"criteria": [{"name": "Mazmun", "points": 40}, ...]}
    rubric_json: Mapped[Any] = mapped_column(
        JSON(),
        nullable=True,
    )

    order_number: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
    )

    # AI generatsiya qilganda izoh (MCQ uchun)
    explanation: Mapped[str | None] = mapped_column(
        Text(),
        nullable=True,
    )

    points_max: Mapped[int] = mapped_column(
        default=100,
        nullable=False,
    )

    # --- Relationships ---
    assignment: Mapped["Assignment"] = relationship(
        "Assignment",
        back_populates="questions",
        lazy="select",
    )
