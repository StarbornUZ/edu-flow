import enum
import uuid
from typing import Any

from sqlalchemy import UUID, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class SubmissionStatus(str, enum.Enum):
    pending = "pending"                      # Yuborildi, AI tekshirmoqda
    ai_reviewed = "ai_reviewed"              # AI tekshirdi, teacher tasdiqlashni kutmoqda
    teacher_confirmed = "teacher_confirmed"  # Teacher tasdiqladi — yakuniy


class Submission(Base, TimestampMixin):
    """O'quvchining vazifaga javobi (bir urinish).

    O'quvchi bir vazifani bir necha marta yechishi mumkin (max_attempts gacha).
    Har bir urinish alohida Submission yaratadi.
    """
    __tablename__ = "submissions"

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Barcha savollar uchun javoblar bir JSON da
    # {"question_id": "answer_value", ...}
    answers_json: Mapped[Any] = mapped_column(
        JSON(),
        nullable=False,
    )

    # Nechanchi urinish bu
    attempt_num: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
    )

    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, name="submission_status"),
        default=SubmissionStatus.pending,
        nullable=False,
    )

    # --- Relationships ---
    assignment: Mapped["Assignment"] = relationship(  # type: ignore[name-defined]
        "Assignment",
        back_populates="submissions",
        lazy="select",
    )
    results: Mapped[list["SubmissionResult"]] = relationship(
        "SubmissionResult",
        back_populates="submission",
        lazy="select",
    )


class SubmissionResult(Base, TimestampMixin):
    """Har bir savol uchun individual natija.

    AI dastlab ball taklif qiladi.
    Ochiq savol uchun teacher tasdiqlaydi yoki o'zgartiradi.
    Yakuniy ball teacher_score (agar tekshirilgan) yoki ai_score.
    """
    __tablename__ = "submission_results"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # O'quvchi bergan javob (JSON — format bo'yicha tuzilma)
    student_answer: Mapped[Any] = mapped_column(
        JSON(),
        nullable=False,
    )

    # AI tomonidan berilgan ball (0.0..points_max, float — partial credit uchun)
    ai_score: Mapped[float | None] = mapped_column(
        Float(),
        nullable=True,
    )

    # AI tomonidan berilgan izoh
    ai_feedback: Mapped[str | None] = mapped_column(
        Text(),
        nullable=True,
    )

    # Teacher tomonidan tasdiqlangan/o'zgartirilgan ball
    # NULL = hali tekshirilmagan
    teacher_score: Mapped[float | None] = mapped_column(
        Float(),
        nullable=True,
    )

    teacher_note: Mapped[str | None] = mapped_column(
        Text(),
        nullable=True,
    )

    # MCQ, Fill, Matching, Ordering uchun aniq to'g'ri/noto'g'ri
    is_correct: Mapped[bool | None] = mapped_column(
        nullable=True,
    )

    # Bu savoldan olingan XP
    xp_earned: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    # --- Relationships ---
    submission: Mapped["Submission"] = relationship(
        "Submission",
        back_populates="results",
        lazy="select",
    )


class UserProgress(Base, TimestampMixin):
    """O'quvchining kurs moduli bo'yicha progressi.

    Modulni tugatgan o'quvchi uchun yozuv yaratiladi.
    """
    __tablename__ = "user_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_modules.id", ondelete="CASCADE"),
        nullable=False,
    )

    xp_earned: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )


class Achievement(Base, TimestampMixin):
    """O'quvchi / o'qituvchi qo'lga kiritgan yutuq/nishon.

    badge_type misollari:
    - "streak_3"     — 3 kunlik streak
    - "streak_7"     — 7 kunlik streak
    - "streak_30"    — 30 kunlik streak
    - "level_2"      — 2-darajaga yetdi
    - "course_100"   — kursni 100% tugatdi
    """
    __tablename__ = "achievements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    badge_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Qo'shimcha ma'lumotlar: {"streak_days": 7, "course_id": "..."}
    metadata_json: Mapped[Any] = mapped_column(
        JSON(),
        nullable=True,
    )


class AILog(Base, TimestampMixin):
    """Har bir Claude API chaqiruvi uchun audit yozuvi.

    Personal ma'lumotlar saqlanmaydi — faqat texnik metrika.
    """
    __tablename__ = "ai_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Qaysi endpoint ishlatdi: "course_generation", "assignment_generation", "grading"
    endpoint: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    # SHA-256 hash — prompt mazmunini saqlamasdan cache uchun ishlatiladi
    prompt_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    # Sarflangan tokenlar soni (input + output)
    tokens_used: Mapped[int | None] = mapped_column(
        Integer(),
        nullable=True,
    )

    # Javob vaqti millisoniyalarda
    response_ms: Mapped[int | None] = mapped_column(
        Integer(),
        nullable=True,
    )
