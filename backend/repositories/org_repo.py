"""Organization repository — DB operatsiyalari."""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.organization import (
    Organization,
    OrganizationMember,
    OrganizationRequest,
    OrgMemberRole,
    OrgStatus,
    OrganizationRequestStatus,
)


class OrgRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # Organization CRUD
    # -------------------------------------------------------------------------

    async def create(
        self,
        name: str,
        type: str,
        owner_id: uuid.UUID,
        address: str | None = None,
        phone: str | None = None,
        stir: str | None = None,
    ) -> Organization:
        org = Organization(
            name=name,
            type=type,
            owner_id=owner_id,
            address=address,
            phone=phone,
            stir=stir,
        )
        self.db.add(org)
        await self.db.commit()
        await self.db.refresh(org)
        return org

    async def get_by_id(self, org_id: uuid.UUID) -> Organization | None:
        result = await self.db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[Organization]:
        result = await self.db.execute(select(Organization))
        return list(result.scalars().all())

    async def get_all_with_counts(self) -> list[tuple]:
        """Barcha tashkilotlar + o'qituvchilar va o'quvchilar soni."""
        from sqlalchemy import func, case
        stmt = (
            select(
                Organization,
                func.count(
                    case((OrganizationMember.role_in_org == OrgMemberRole.teacher, OrganizationMember.id))
                ).label("teachers_count"),
                func.count(
                    case((OrganizationMember.role_in_org == OrgMemberRole.student, OrganizationMember.id))
                ).label("students_count"),
            )
            .outerjoin(OrganizationMember, OrganizationMember.org_id == Organization.id)
            .group_by(Organization.id)
            .order_by(Organization.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.all())

    async def update(self, org: Organization, **kwargs) -> Organization:
        for key, value in kwargs.items():
            setattr(org, key, value)
        await self.db.commit()
        await self.db.refresh(org)
        return org

    # -------------------------------------------------------------------------
    # OrganizationRequest
    # -------------------------------------------------------------------------

    async def create_request(
        self, user_id: uuid.UUID, org_data: dict
    ) -> OrganizationRequest:
        req = OrganizationRequest(user_id=user_id, org_data=org_data)
        self.db.add(req)
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def get_request(self, request_id: uuid.UUID) -> OrganizationRequest | None:
        result = await self.db.execute(
            select(OrganizationRequest).where(OrganizationRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def get_user_latest_request(self, user_id: uuid.UUID) -> OrganizationRequest | None:
        from sqlalchemy import desc
        result = await self.db.execute(
            select(OrganizationRequest)
            .where(OrganizationRequest.user_id == user_id)
            .order_by(desc(OrganizationRequest.created_at))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_all_requests(self) -> list[OrganizationRequest]:
        result = await self.db.execute(select(OrganizationRequest))
        return list(result.scalars().all())

    async def approve_request(
        self,
        req: OrganizationRequest,
        reviewed_by: uuid.UUID,
        review_note: str | None,
        org: Organization,
    ) -> OrganizationRequest:
        req.status = OrganizationRequestStatus.approved
        req.reviewed_by = reviewed_by
        req.review_note = review_note
        req.organization_id = org.id
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def reject_request(
        self,
        req: OrganizationRequest,
        reviewed_by: uuid.UUID,
        review_note: str | None,
    ) -> OrganizationRequest:
        req.status = OrganizationRequestStatus.rejected
        req.reviewed_by = reviewed_by
        req.review_note = review_note
        await self.db.commit()
        await self.db.refresh(req)
        return req

    # -------------------------------------------------------------------------
    # OrganizationMember
    # -------------------------------------------------------------------------

    async def add_member(
        self,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        role_in_org: str,
    ) -> OrganizationMember:
        member = OrganizationMember(
            org_id=org_id,
            user_id=user_id,
            role_in_org=role_in_org,
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def get_member(
        self, org_id: uuid.UUID, user_id: uuid.UUID
    ) -> OrganizationMember | None:
        result = await self.db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_members(self, org_id: uuid.UUID) -> list[OrganizationMember]:
        result = await self.db.execute(
            select(OrganizationMember).where(OrganizationMember.org_id == org_id)
        )
        return list(result.scalars().all())

    async def remove_member(self, member: OrganizationMember) -> None:
        await self.db.delete(member)
        await self.db.commit()
