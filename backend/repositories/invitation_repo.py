"""OrgInvitation repository."""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.org_invitation import OrgInvitation, InvitationStatus
from backend.db.models.organization import Organization
from backend.db.models.user import User


class InvitationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        org_id: uuid.UUID,
        invited_user_id: uuid.UUID,
        invited_by: uuid.UUID,
        role_in_org: str,
        message: str | None = None,
    ) -> OrgInvitation:
        inv = OrgInvitation(
            org_id=org_id,
            invited_user_id=invited_user_id,
            invited_by=invited_by,
            role_in_org=role_in_org,
            status=InvitationStatus.pending,
            message=message,
        )
        self.db.add(inv)
        await self.db.commit()
        await self.db.refresh(inv)
        return inv

    async def get_by_id(self, inv_id: uuid.UUID) -> OrgInvitation | None:
        result = await self.db.execute(
            select(OrgInvitation).where(OrgInvitation.id == inv_id)
        )
        return result.scalar_one_or_none()

    async def get_org_invitations(
        self, org_id: uuid.UUID, status: str | None = None
    ) -> list[tuple[OrgInvitation, User]]:
        """Org uchun taklif ro'yxati, foydalanuvchi ma'lumotlari bilan."""
        q = (
            select(OrgInvitation, User)
            .join(User, User.id == OrgInvitation.invited_user_id)
            .where(OrgInvitation.org_id == org_id)
        )
        if status:
            q = q.where(OrgInvitation.status == status)
        q = q.order_by(OrgInvitation.created_at.desc())
        result = await self.db.execute(q)
        return list(result.all())

    async def get_user_invitations(
        self, user_id: uuid.UUID, status: str = "pending"
    ) -> list[tuple[OrgInvitation, Organization]]:
        """Foydalanuvchiga yuborilgan takliflar, org nomi bilan."""
        q = (
            select(OrgInvitation, Organization)
            .join(Organization, Organization.id == OrgInvitation.org_id)
            .where(OrgInvitation.invited_user_id == user_id)
        )
        if status:
            q = q.where(OrgInvitation.status == status)
        q = q.order_by(OrgInvitation.created_at.desc())
        result = await self.db.execute(q)
        return list(result.all())

    async def get_pending_for_user_in_org(
        self, user_id: uuid.UUID, org_id: uuid.UUID
    ) -> OrgInvitation | None:
        result = await self.db.execute(
            select(OrgInvitation).where(
                OrgInvitation.invited_user_id == user_id,
                OrgInvitation.org_id == org_id,
                OrgInvitation.status == InvitationStatus.pending,
            )
        )
        return result.scalar_one_or_none()

    async def update_status(
        self, invitation: OrgInvitation, status: InvitationStatus
    ) -> OrgInvitation:
        invitation.status = status
        await self.db.commit()
        await self.db.refresh(invitation)
        return invitation
