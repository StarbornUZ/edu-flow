import enum
import uuid
from datetime import datetime

from sqlalchemy import UUID, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class ClassEnrollmentStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class Class(Base, TimestampMixin):
    """Sinf (o'quv guruhi).

    O'qituvchi sinf yaratadi → unikal 6 belgili class_code generatsiya qilinadi.
    O'quvchilar sinf kodini kiritib a'zo bo'ladi.
    """
    __tablename__ = "classes"

    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    grade_level: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # "2025-2026" formatida
    academic_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Unikal 6 belgili kod — o'quvchilar shu orqali qo'shiladi
    # Misol: "ABC123", "XY7Z9Q"
    class_code: Mapped[str] = mapped_column(
        String(6),
        unique=True,
        index=True,
        nullable=False,
    )

    # Sinf kodi faollik muddati (yaratilgandan 24 soat)
    # Muddati o'tgach teacher /refresh-code orqali yangilaydi
    class_code_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # --- Relationships ---
    teacher: Mapped["User"] = relationship(       # type: ignore[name-defined]
        "User",
        back_populates="classes",
        lazy="select",
    )
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        "ClassEnrollment",
        back_populates="class_",
        lazy="select",
    )


class ClassEnrollment(Base, TimestampMixin):
    """O'quvchi ↔ Sinf ko'p-to-ko'p aloqasi.

    O'quvchi sinf kodini kiritganda bu jadvalga yozuv qo'shiladi.
    """
    __tablename__ = "class_enrollments"

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[ClassEnrollmentStatus] = mapped_column(
        Enum(ClassEnrollmentStatus, name="class_enrollment_status"),
        default=ClassEnrollmentStatus.active,
        nullable=False,
    )

    # --- Relationships ---
    class_: Mapped["Class"] = relationship(
        "Class",
        back_populates="enrollments",
        lazy="select",
    )
    student: Mapped["User"] = relationship(      # type: ignore[name-defined]
        "User",
        foreign_keys=[student_id],
        lazy="select",
    )
