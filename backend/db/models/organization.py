import enum
import uuid
from sqlalchemy import UUID, Enum, ForeignKey, JSON, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class OrgType(str, enum.Enum):
    school = "school"
    learning_center = "learning_center"
    university = "university"


class OrgPlan(str, enum.Enum):
    free_trial = "free_trial"
    starter = "starter"
    growth = "growth"
    scale = "scale"


class OrgStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    trial = "trial"


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[OrgType] = mapped_column(Enum(OrgType, name="org_type"), nullable=False)
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    stir: Mapped[str | None] = mapped_column(String(20), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan: Mapped[OrgPlan] = mapped_column(
        Enum(OrgPlan, name="org_plan"), default=OrgPlan.free_trial, nullable=False
    )
    status: Mapped[OrgStatus] = mapped_column(
        Enum(OrgStatus, name="org_status"), default=OrgStatus.trial, nullable=False
    )
    ai_token_limit: Mapped[int | None] = mapped_column(nullable=True)
    ai_tokens_used: Mapped[int] = mapped_column(default=0, nullable=False)

    members: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="organization", lazy="select"
    )
    requests: Mapped[list["OrganizationRequest"]] = relationship(
        "OrganizationRequest", back_populates="organization_ref", lazy="select"
    )


class OrganizationRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class OrganizationRequest(Base, TimestampMixin):
    __tablename__ = "organization_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[OrganizationRequestStatus] = mapped_column(
        Enum(OrganizationRequestStatus, name="org_request_status"),
        default=OrganizationRequestStatus.pending, nullable=False
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )

    requester: Mapped["User"] = relationship(  # type: ignore
        "User", foreign_keys=[user_id], lazy="select"
    )
    reviewer: Mapped["User | None"] = relationship(  # type: ignore
        "User", foreign_keys=[reviewed_by], lazy="select"
    )
    organization_ref: Mapped["Organization | None"] = relationship(
        "Organization", back_populates="requests", foreign_keys=[organization_id], lazy="select"
    )


class OrgMemberRole(str, enum.Enum):
    org_admin = "org_admin"
    teacher = "teacher"
    student = "student"
    parent = "parent"


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role_in_org: Mapped[OrgMemberRole] = mapped_column(
        Enum(OrgMemberRole, name="org_member_role"), nullable=False
    )

    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="members", lazy="select"
    )
    user: Mapped["User"] = relationship("User", lazy="select")  # type: ignore
