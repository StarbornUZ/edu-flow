"""Tashkilotlar endpointlari."""
import uuid

from fastapi import APIRouter, HTTPException, status

from backend.api.deps import CurrentAdmin, CurrentOrgAdmin, CurrentUser, DBSession
from backend.api.middleware.org_scope import verify_org_access
from backend.db.models.organization import OrgStatus
from backend.db.models.user import UserRole
from backend.repositories.org_repo import OrgRepository
from backend.schemas.organization import (
    OrgMemberAdd,
    OrgMemberResponse,
    OrgRequestCreate,
    OrgRequestResponse,
    OrgRequestReview,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
)

router = APIRouter()


def _repo(db: DBSession) -> OrgRepository:
    return OrgRepository(db)


async def _get_org_or_404(repo: OrgRepository, org_id: uuid.UUID) -> object:
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tashkilot topilmadi")
    return org


# ---------------------------------------------------------------------------
# GET /organizations — barcha tashkilotlar (admin)
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[OrganizationResponse],
    summary="Barcha tashkilotlar (faqat admin)",
)
async def list_organizations(admin: CurrentAdmin, db: DBSession):
    orgs = await _repo(db).get_all()
    return [OrganizationResponse.model_validate(o) for o in orgs]


# ---------------------------------------------------------------------------
# POST /organizations — yangi tashkilot yaratish (admin)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi tashkilot yaratish (admin)",
)
async def create_organization(
    data: OrganizationCreate, admin: CurrentAdmin, db: DBSession
):
    org = await _repo(db).create(
        name=data.name,
        type=data.type,
        owner_id=admin.id,
        address=data.address,
        phone=data.phone,
        stir=data.stir,
    )
    return OrganizationResponse.model_validate(org)


# ---------------------------------------------------------------------------
# POST /organizations/requests — tashkilot so'rovi yuborish
# (must be before /{org_id} to avoid UUID parse error)
# ---------------------------------------------------------------------------

@router.post(
    "/requests",
    response_model=OrgRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tashkilot ochish so'rovi yuborish",
)
async def submit_org_request(
    data: OrgRequestCreate, user: CurrentUser, db: DBSession
):
    req = await _repo(db).create_request(user.id, data.org_data)
    return OrgRequestResponse.model_validate(req)


# ---------------------------------------------------------------------------
# GET /organizations/requests — barcha so'rovlar (admin)
# ---------------------------------------------------------------------------

@router.get(
    "/requests",
    response_model=list[OrgRequestResponse],
    summary="Barcha tashkilot so'rovlari (admin)",
)
async def list_org_requests(admin: CurrentAdmin, db: DBSession):
    reqs = await _repo(db).get_all_requests()
    return [OrgRequestResponse.model_validate(r) for r in reqs]


# ---------------------------------------------------------------------------
# POST /organizations/requests/{id}/review — so'rovni ko'rib chiqish (admin)
# ---------------------------------------------------------------------------

@router.post(
    "/requests/{request_id}/review",
    response_model=OrgRequestResponse,
    summary="Tashkilot so'rovini ko'rib chiqish (admin)",
)
async def review_org_request(
    request_id: uuid.UUID,
    data: OrgRequestReview,
    admin: CurrentAdmin,
    db: DBSession,
):
    repo = _repo(db)
    req = await repo.get_request(request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "So'rov topilmadi")

    if data.approve:
        # Yangi tashkilot yaratish
        org_data = req.org_data
        org = await repo.create(
            name=org_data.get("name", ""),
            type=org_data.get("type", "school"),
            owner_id=req.user_id,
            address=org_data.get("address"),
            phone=org_data.get("phone"),
            stir=org_data.get("stir"),
        )
        # Org_admin sifatida a'zo qilish
        await repo.add_member(org.id, req.user_id, "org_admin")
        reviewed = await repo.approve_request(req, admin.id, data.review_note, org)
    else:
        reviewed = await repo.reject_request(req, admin.id, data.review_note)

    return OrgRequestResponse.model_validate(reviewed)


# ---------------------------------------------------------------------------
# GET /organizations/my-request — joriy foydalanuvchining oxirgi so'rovi
# (must be before /{org_id} to avoid UUID parse error)
# ---------------------------------------------------------------------------

@router.get(
    "/my-request",
    response_model=OrgRequestResponse,
    summary="Mening tashkilot so'rovim",
)
async def get_my_org_request(user: CurrentUser, db: DBSession):
    req = await _repo(db).get_user_latest_request(user.id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "So'rov topilmadi")
    return OrgRequestResponse.model_validate(req)


# ---------------------------------------------------------------------------
# GET /organizations/{id}
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}",
    response_model=OrganizationResponse,
    summary="Tashkilot ma'lumotlari",
)
async def get_organization(org_id: uuid.UUID, user: CurrentUser, db: DBSession):
    repo = _repo(db)
    org = await _get_org_or_404(repo, org_id)
    await verify_org_access(org_id, user, db)
    return OrganizationResponse.model_validate(org)


# ---------------------------------------------------------------------------
# PATCH /organizations/{id}
# ---------------------------------------------------------------------------

@router.patch(
    "/{org_id}",
    response_model=OrganizationResponse,
    summary="Tashkilot ma'lumotlarini yangilash (org_admin yoki admin)",
)
async def update_organization(
    org_id: uuid.UUID,
    data: OrganizationUpdate,
    user: CurrentUser,
    db: DBSession,
):
    repo = _repo(db)
    org = await _get_org_or_404(repo, org_id)
    await verify_org_access(org_id, user, db, require_admin=True)

    updates = data.model_dump(exclude_none=True)
    if updates:
        updated = await repo.update(org, **updates)
    else:
        updated = org
    return OrganizationResponse.model_validate(updated)


# ---------------------------------------------------------------------------
# GET /organizations/{id}/members
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}/members",
    response_model=list[OrgMemberResponse],
    summary="Tashkilot a'zolari",
)
async def list_members(org_id: uuid.UUID, user: CurrentUser, db: DBSession):
    await _get_org_or_404(_repo(db), org_id)
    await verify_org_access(org_id, user, db)
    members = await _repo(db).get_members(org_id)
    return [OrgMemberResponse.model_validate(m) for m in members]


# ---------------------------------------------------------------------------
# POST /organizations/{id}/members — a'zo qo'shish (org_admin/admin)
# ---------------------------------------------------------------------------

@router.post(
    "/{org_id}/members",
    response_model=OrgMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tashkilotga a'zo qo'shish",
)
async def add_member(
    org_id: uuid.UUID,
    data: OrgMemberAdd,
    user: CurrentUser,
    db: DBSession,
):
    repo = _repo(db)
    await _get_org_or_404(repo, org_id)
    await verify_org_access(org_id, user, db, require_admin=True)

    existing = await repo.get_member(org_id, data.user_id)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Foydalanuvchi allaqachon a'zo")

    member = await repo.add_member(org_id, data.user_id, data.role_in_org)
    return OrgMemberResponse.model_validate(member)


# ---------------------------------------------------------------------------
# DELETE /organizations/{id}/members/{user_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/{org_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="A'zoni tashkilotdan chiqarish",
)
async def remove_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
):
    repo = _repo(db)
    await _get_org_or_404(repo, org_id)
    await verify_org_access(org_id, user, db, require_admin=True)

    member = await repo.get_member(org_id, user_id)
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "A'zo topilmadi")
    await repo.remove_member(member)
