import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.models.organization import OrganizationMember
from backend.db.models.user import User, UserRole


async def verify_org_access(
    org_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    require_admin: bool = False
) -> None:
    if current_user.role == UserRole.admin:
        return
    member_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Bu tashkilotga kirish ruxsati yo'q")
    if require_admin and member.role_in_org != "org_admin":
        raise HTTPException(status_code=403, detail="Org-admin roli kerak")
