"""Tashkilotlar endpointlari."""
import random
import re
import string
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from backend.api.deps import CurrentAdmin, CurrentOrgAdmin, CurrentUser, DBSession
from backend.api.middleware.org_scope import verify_org_access
from backend.core.security import hash_password
from backend.repositories.org_repo import OrgRepository
from backend.repositories.user_repo import UserRepository
from backend.schemas.auth import UserResponse
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
# Helpers — auto-generation
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """'Ism Familiya' → 'ism.familiya'"""
    text = text.strip().lower()
    # Kirill → lotin transliteratsiya qilinmaydi, noto'g'ri harflar olib tashlanadi
    text = re.sub(r"[^a-z0-9\s]", "", text)
    parts = text.split()[:2]
    return ".".join(p for p in parts if p) or "user"


def _generate_username(full_name: str) -> str:
    base = _slugify(full_name)
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{base}.{suffix}"


def _generate_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


async def _unique_username(user_repo: UserRepository, full_name: str) -> str:
    """Unikal username generatsiya qiladi (takrorlanishgacha qayta uradi)."""
    for _ in range(10):
        username = _generate_username(full_name)
        existing = await user_repo.get_by_username(username)
        if not existing:
            return username
    # Agar 10 ta urinishda topilmasa — timestamp qo'shish
    return _generate_username(full_name) + str(random.randint(100, 999))


# ---------------------------------------------------------------------------
# GET /organizations
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
# POST /organizations
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
# POST /organizations/requests
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
# GET /organizations/requests
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
# POST /organizations/requests/{id}/review
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
        org_data = req.org_data
        org = await repo.create(
            name=org_data.get("name", ""),
            type=org_data.get("type", "school"),
            owner_id=req.user_id,
            address=org_data.get("address"),
            phone=org_data.get("phone"),
            stir=org_data.get("stir"),
        )
        await repo.add_member(org.id, req.user_id, "org_admin")

        # Org_admin foydalanuvchisining org_id maydonini yangilash
        user_repo = UserRepository(db)
        req_user = await user_repo.get_by_id(req.user_id)
        if req_user and req_user.org_id is None:
            await user_repo.update(req_user, org_id=org.id)

        reviewed = await repo.approve_request(req, admin.id, data.review_note, org)
    else:
        reviewed = await repo.reject_request(req, admin.id, data.review_note)

    return OrgRequestResponse.model_validate(reviewed)


# ---------------------------------------------------------------------------
# GET /organizations/my-request
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
    summary="Tashkilot ma'lumotlarini yangilash",
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
    updated = await repo.update(org, **updates) if updates else org
    return OrganizationResponse.model_validate(updated)


# ---------------------------------------------------------------------------
# GET /organizations/{id}/members — returns User-like data
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}/members",
    response_model=list[UserResponse],
    summary="Tashkilot a'zolari (foydalanuvchi ma'lumotlari bilan)",
)
async def list_members(org_id: uuid.UUID, user: CurrentUser, db: DBSession):
    await _get_org_or_404(_repo(db), org_id)
    await verify_org_access(org_id, user, db)
    members = await UserRepository(db).get_by_org(org_id)
    return [UserResponse.model_validate(m) for m in members]


# ---------------------------------------------------------------------------
# POST /organizations/{id}/members — mavjud foydalanuvchini qo'shish
# ---------------------------------------------------------------------------

@router.post(
    "/{org_id}/members",
    response_model=OrgMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tashkilotga mavjud foydalanuvchini qo'shish",
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

    # user.org_id ni yangilash
    user_repo = UserRepository(db)
    target_user = await user_repo.get_by_id(data.user_id)
    if target_user and target_user.org_id is None:
        await user_repo.update(target_user, org_id=org_id)

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


# ---------------------------------------------------------------------------
# GET /organizations/{id}/users/search
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}/users/search",
    response_model=list[UserResponse],
    summary="Email yoki username bo'yicha foydalanuvchi qidirish (org_admin)",
)
async def search_users(
    org_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
    email: str = Query(..., min_length=1),
    role: str | None = Query(None),
):
    await verify_org_access(org_id, user, db, require_admin=True)
    users = await UserRepository(db).search_by_email(email, role=role)
    return [UserResponse.model_validate(u) for u in users]


# ---------------------------------------------------------------------------
# POST /organizations/{id}/users — yangi foydalanuvchi yaratib qo'shish
# ---------------------------------------------------------------------------

class CreateMemberRequest(BaseModel):
    full_name: str
    role_in_org: str          # "teacher" | "student"
    email: str | None = None  # None → tizim generatsiya qiladi
    password: str | None = None  # None → tizim generatsiya qiladi


class CreateMemberResponse(BaseModel):
    """Foydalanuvchi ma'lumotlari + tizim tomonidan yaratilgan login/parol."""
    id: str
    full_name: str
    email: str
    username: str
    generated_password: str   # admin uchun ko'rsatiladi, DB da system_password saqlanadi
    role: str
    org_id: str | None = None


@router.post(
    "/{org_id}/users",
    response_model=CreateMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi foydalanuvchi yaratib tashkilotga qo'shish (org_admin)",
)
async def create_and_add_member(
    org_id: uuid.UUID,
    data: CreateMemberRequest,
    user: CurrentUser,
    db: DBSession,
):
    await verify_org_access(org_id, user, db, require_admin=True)

    user_repo = UserRepository(db)

    # Username generatsiya
    username = await _unique_username(user_repo, data.full_name)

    # Parol generatsiya
    plain_password = data.password or _generate_password()

    # Email: berilmasa tizim generatsiya qiladi
    email = data.email
    if not email:
        email = f"{username}@eduflow.local"
    else:
        existing = await user_repo.get_by_email(email)
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, "Bu email allaqachon ro'yxatdan o'tgan")

    new_user = await user_repo.create(
        email=email,
        password_hash=hash_password(plain_password),
        full_name=data.full_name,
        role=data.role_in_org,
        org_id=org_id,
        username=username,
        system_password=plain_password,  # admin ko'rishi uchun
    )

    org_repo = _repo(db)
    await _get_org_or_404(org_repo, org_id)
    await org_repo.add_member(org_id, new_user.id, data.role_in_org)

    return CreateMemberResponse(
        id=str(new_user.id),
        full_name=new_user.full_name,
        email=new_user.email,
        username=new_user.username,
        generated_password=plain_password,
        role=new_user.role,
        org_id=str(new_user.org_id) if new_user.org_id else None,
    )


# ---------------------------------------------------------------------------
# GET /organizations/{id}/members/{user_id}/credentials — admin parolni ko'radi
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}/members/{user_id}/credentials",
    summary="Tizim yaratgan login va parolni ko'rish (org_admin)",
)
async def get_member_credentials(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: CurrentOrgAdmin,
    db: DBSession,
):
    await verify_org_access(org_id, admin, db, require_admin=True)
    target = await UserRepository(db).get_by_id(user_id)
    if not target or target.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foydalanuvchi topilmadi")

    return {
        "email": target.email,
        "username": target.username,
        "system_password": target.system_password,  # None → user o'zgartirgan
    }


# ---------------------------------------------------------------------------
# POST /organizations/{id}/members/{user_id}/reset-password
# ---------------------------------------------------------------------------

@router.post(
    "/{org_id}/members/{user_id}/reset-password",
    summary="Foydalanuvchi parolini tiklash (org_admin)",
)
async def reset_member_password(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: CurrentOrgAdmin,
    db: DBSession,
):
    await verify_org_access(org_id, admin, db, require_admin=True)
    user_repo = UserRepository(db)
    target = await user_repo.get_by_id(user_id)
    if not target or target.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foydalanuvchi topilmadi")

    new_password = _generate_password()
    await user_repo.update(
        target,
        password_hash=hash_password(new_password),
        system_password=new_password,
    )

    return {
        "message": "Parol muvaffaqiyatli tiklandi",
        "username": target.username,
        "email": target.email,
        "new_password": new_password,
    }


# ---------------------------------------------------------------------------
# GET /organizations/{id}/members/{user_id}/profile — profil + statistika
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}/members/{user_id}/profile",
    summary="A'zo profili va statistikasi (org_admin)",
)
async def get_member_profile(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: CurrentOrgAdmin,
    db: DBSession,
):
    await verify_org_access(org_id, admin, db, require_admin=True)
    from sqlalchemy import select, func
    from backend.db.models.class_ import Class, ClassEnrollment
    from backend.db.models.course import Course, CourseEnrollment

    target = await UserRepository(db).get_by_id(user_id)
    if not target or target.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "A'zo topilmadi")

    profile: dict = {
        "id": str(target.id),
        "full_name": target.full_name,
        "email": target.email,
        "username": target.username,
        "role": str(target.role),
        "avatar_url": target.avatar_url,
        "phone": target.phone,
        "xp": target.xp,
        "level": target.level,
        "streak_count": target.streak_count,
        "created_at": target.created_at.isoformat(),
    }

    if str(target.role) in ("teacher", "org_admin"):
        # O'qituvchining sinflari
        cls_result = await db.execute(
            select(Class).where(Class.teacher_id == user_id, Class.org_id == org_id)
        )
        classes = cls_result.scalars().all()

        # Har bir sinfning o'quvchi soni
        classes_data = []
        for cls in classes:
            cnt = await db.execute(
                select(func.count()).where(ClassEnrollment.class_id == cls.id)
            )
            classes_data.append({
                "id": str(cls.id),
                "name": cls.name,
                "academic_year": cls.academic_year,
                "grade_level": cls.grade_level,
                "class_code": cls.class_code,
                "student_count": cnt.scalar_one(),
            })

        # Kurslari
        courses_result = await db.execute(
            select(Course).where(Course.teacher_id == user_id).order_by(Course.created_at.desc()).limit(10)
        )
        courses = courses_result.scalars().all()

        profile["classes"] = classes_data
        profile["courses"] = [
            {"id": str(c.id), "title": c.title, "subject": c.subject, "status": str(c.status)}
            for c in courses
        ]
        profile["stats"] = {
            "classes_count": len(classes_data),
            "courses_count": len(courses),
            "students_count": sum(c["student_count"] for c in classes_data),
        }

    else:  # student
        # O'quvchining sinflari
        enroll_result = await db.execute(
            select(Class)
            .join(ClassEnrollment, ClassEnrollment.class_id == Class.id)
            .where(ClassEnrollment.student_id == user_id, Class.org_id == org_id)
        )
        classes = enroll_result.scalars().all()

        # Kurslari (sinf orqali yoki to'g'ridan-to'g'ri)
        courses_result = await db.execute(
            select(Course)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .where(CourseEnrollment.student_id == user_id)
            .limit(10)
        )
        courses = courses_result.scalars().all()

        profile["classes"] = [
            {"id": str(c.id), "name": c.name, "academic_year": c.academic_year, "grade_level": c.grade_level}
            for c in classes
        ]
        profile["courses"] = [
            {"id": str(c.id), "title": c.title, "subject": c.subject, "status": str(c.status)}
            for c in courses
        ]
        profile["stats"] = {
            "classes_count": len(classes),
            "courses_count": len(courses),
            "xp": target.xp,
            "level": target.level,
            "streak_count": target.streak_count,
        }

    return profile
