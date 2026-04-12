import uuid
from sqlalchemy import UUID, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class Badge(Base, TimestampMixin):
    __tablename__ = "badges"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    icon: Mapped[str] = mapped_column(String(100), nullable=False)
    condition: Mapped[dict] = mapped_column(JSON, nullable=False)

    student_badges: Mapped[list["StudentBadge"]] = relationship(
        "StudentBadge", back_populates="badge", lazy="select"
    )


class StudentBadge(Base, TimestampMixin):
    __tablename__ = "student_badges"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False
    )

    badge: Mapped["Badge"] = relationship("Badge", back_populates="student_badges")
    student: Mapped["User"] = relationship("User", lazy="select")  # type: ignore
