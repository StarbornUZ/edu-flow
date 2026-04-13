import uuid

from sqlalchemy import UUID, Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class Notification(Base, TimestampMixin):
    """Foydalanuvchi uchun bildirishnomalar."""

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "live_session_invite" | "system" | ...
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # e.g. {"session_id": "...", "game_type": "blitz"}
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
