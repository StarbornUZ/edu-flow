import uuid
from sqlalchemy import UUID, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class Topic(Base, TimestampMixin):
    """Mavzu: CourseModule → Topic → Assignment zanjiri"""
    __tablename__ = "topics"

    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_modules.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_latex: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)
