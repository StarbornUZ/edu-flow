import enum
import uuid
from datetime import datetime

from sqlalchemy import UUID, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class CourseStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class CourseDifficulty(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
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

    title: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
    )

    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    difficulty: Mapped[CourseDifficulty] = mapped_column(
        Enum(CourseDifficulty, name="course_difficulty"),
        default=CourseDifficulty.beginner,
        nullable=False,
    )

    cover_url: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
    )

    # AI tomonidan generatsiya qilinganmi?
    is_ai_generated: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # O'quvchi yaratgan kurs admin/teacher tomonidan tekshirilganmi?
    is_verified: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus, name="course_status"),
        default=CourseStatus.draft,
        nullable=False,
    )

    # --- Relationships ---
    teacher: Mapped["User"] = relationship(       # type: ignore[name-defined]
        "User",
        back_populates="courses",
        lazy="select",
    )
    modules: Mapped[list["CourseModule"]] = relationship(
        "CourseModule",
        back_populates="course",
        lazy="select",
        order_by="CourseModule.order_number",
    )
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(
        "CourseEnrollment",
        back_populates="course",
        lazy="select",
    )


class CourseModule(Base, TimestampMixin):
    __tablename__ = "course_modules"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    content_md: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        default="",
        server_default="",
    )

    order_number: Mapped[int] = mapped_column(
        nullable=False,
    )

    # Linked-list tuzilma — modullar tartibi uchun (ixtiyoriy)
    prev_module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_modules.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_published: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # --- Relationships ---
    course: Mapped["Course"] = relationship(
        "Course",
        back_populates="modules",
        lazy="select",
    )


class CourseEnrollment(Base, TimestampMixin):
    """Kurs + Sinf + O'quvchi uchlik aloqasi.

    O'qituvchi kursni sinfga biriktiradi → sinfning har bir o'quvchisi
    bu kursga avtomatik yoziladi.
    """
    __tablename__ = "course_enrollments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # NULL → butun sinf yozilgan (class_id orqali tekshiriladi)
    # UUID → individual student yozilgan
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    enrolled_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Relationships ---
    course: Mapped["Course"] = relationship(
        "Course",
        back_populates="enrollments",
        lazy="select",
    )
