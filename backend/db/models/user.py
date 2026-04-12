import enum
import uuid
from datetime import date

from sqlalchemy import UUID, Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class UserRole(str, enum.Enum):
    teacher = "teacher"
    student = "student"
    admin = "admin"
    org_admin = "org_admin"
    parent = "parent"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        default=UserRole.student,
        nullable=False,
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Gamifikatsiya ---
    xp: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    level: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
    )

    streak_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    # date tipida saqlanadi (datetime emas — faqat kun muhim)
    streak_last_date: Mapped[date | None] = mapped_column(
        Date(),
        nullable=True,
    )

    # --- Relationships ---
    courses: Mapped[list["Course"]] = relationship(   # type: ignore[name-defined]
        "Course",
        back_populates="teacher",
        lazy="select",
    )
    classes: Mapped[list["Class"]] = relationship(    # type: ignore[name-defined]
        "Class",
        back_populates="teacher",
        lazy="select",
    )
