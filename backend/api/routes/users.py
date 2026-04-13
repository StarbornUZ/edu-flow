"""Foydalanuvchi endpointlari — takliflar va shaxsiy ma'lumotlar."""
import uuid

from fastapi import APIRouter, HTTPException, status

from backend.api.deps import CurrentUser, DBSession
from backend.repositories.invitation_repo import InvitationRepository
from backend.repositories.org_repo import OrgRepository
from backend.repositories.user_repo import UserRepository
from backend.db.models.org_invitation import InvitationStatus
from backend.schemas.invitation import OrgInvitationResponse

router = APIRouter()


def _build_inv_response(inv, org, user) -> OrgInvitationResponse:
    return OrgInvitationResponse(
        id=inv.id,
        org_id=inv.org_id,
        org_name=org.name,
        invited_user_id=inv.invited_user_id,
        invited_user_name=user.full_name,
        invited_user_email=user.email,
        invited_by=inv.invited_by,
        role_in_org=inv.role_in_org,
        status=str(inv.status),
        message=inv.message,
        created_at=inv.created_at,
    )


# ---------------------------------------------------------------------------
# GET /users/me/invitations — mening takliflarim
# ---------------------------------------------------------------------------

@router.get(
    "/me/invitations",
    response_model=list[OrgInvitationResponse],
    summary="Menga yuborilgan takliflar",
)
async def get_my_invitations(user: CurrentUser, db: DBSession):
    rows = await InvitationRepository(db).get_user_invitations(user.id, status="pending")
    return [_build_inv_response(inv, org, user) for inv, org in rows]


# ---------------------------------------------------------------------------
# POST /users/me/invitations/{inv_id}/accept — taklifni qabul qilish
# ---------------------------------------------------------------------------

@router.post(
    "/me/invitations/{inv_id}/accept",
    response_model=OrgInvitationResponse,
    summary="Taklifni qabul qilish",
)
async def accept_invitation(inv_id: uuid.UUID, user: CurrentUser, db: DBSession):
    inv_repo = InvitationRepository(db)
    inv = await inv_repo.get_by_id(inv_id)

    if not inv or inv.invited_user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taklif topilmadi")
    if str(inv.status) != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Taklif allaqachon ko'rib chiqilgan")

    org_repo = OrgRepository(db)
    org = await org_repo.get_by_id(inv.org_id)
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tashkilot topilmadi")

    # A'zo qo'shish
    existing = await org_repo.get_member(inv.org_id, user.id)
    if not existing:
        await org_repo.add_member(inv.org_id, user.id, inv.role_in_org)
        user_repo = UserRepository(db)
        if not user.org_id:
            await user_repo.update(user, org_id=inv.org_id)

    inv = await inv_repo.update_status(inv, InvitationStatus.accepted)
    # user ni qayta yuklash (org_id yangilandi bo'lishi mumkin)
    updated_user = await UserRepository(db).get_by_id(user.id)
    return _build_inv_response(inv, org, updated_user or user)


# ---------------------------------------------------------------------------
# POST /users/me/invitations/{inv_id}/decline — taklifni rad etish
# ---------------------------------------------------------------------------

@router.post(
    "/me/invitations/{inv_id}/decline",
    response_model=OrgInvitationResponse,
    summary="Taklifni rad etish",
)
async def decline_invitation(inv_id: uuid.UUID, user: CurrentUser, db: DBSession):
    inv_repo = InvitationRepository(db)
    inv = await inv_repo.get_by_id(inv_id)

    if not inv or inv.invited_user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taklif topilmadi")
    if str(inv.status) != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Taklif allaqachon ko'rib chiqilgan")

    org_repo = OrgRepository(db)
    org = await org_repo.get_by_id(inv.org_id)

    inv = await inv_repo.update_status(inv, InvitationStatus.declined)
    return _build_inv_response(inv, org, user)
