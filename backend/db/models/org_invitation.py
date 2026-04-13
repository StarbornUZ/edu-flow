import enum
import uuid

from sqlalchemy import UUID, Enum, ForeignKey, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    revoked = "revoked"


class OrgInvitation(Base, TimestampMixin):
    __tablename__ = "org_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    invited_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    role_in_org: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus, name="invitation_status"),
        default=InvitationStatus.pending,
        nullable=False,
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_org_invitations_user_status", "invited_user_id", "status"),
        Index("ix_org_invitations_org_status", "org_id", "status"),
    )
