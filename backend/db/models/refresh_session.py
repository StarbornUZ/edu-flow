from datetime import datetime
from uuid import UUID

from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class RefreshSession(Base, TimestampMixin):
    __tablename__ = "refresh_sessions"

    session_id: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    token_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    replaced_by_token_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("refresh_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
