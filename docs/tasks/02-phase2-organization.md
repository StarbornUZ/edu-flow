# Faza 2 — Organization Flow + RBAC
> **Mas'ul:** Muxtorov Javohirbek
> **Vaqt:** Kun 1 · 11:00–13:00 (~2 soat)
> **Kerak:** Faza 1 tugagan bo'lishi shart
> **Bloklovchi:** Faza 3 (sinf + kurs yaratish uchun org_id kerak)

---

## Kontekst

Bu fazada tashkilot yaratish jarayoni (request → admin tasdiqlash → org_admin roli), org_admin imkoniyatlari va o'qituvchi/o'quvchi/ota-ona yaratish endpointlari yoziladi.

**Asosiy qoida (Org Scope):** Har bir org_admin faqat o'z tashkilotiga tegishli ma'lumotlarga kirishi mumkin. Bu middleware orqali tekshiriladi.

---

## 2.1 — Org Scope Middleware

**Fayl:** `backend/api/middleware/org_scope.py`

```python
"""Org scope helper — har endpoint da qo'llaniladi."""
import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.models.organization import OrganizationMember
from backend.db.models.user import User


async def verify_org_access(
    org_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    require_admin: bool = False
) -> None:
    """
    Foydalanuvchi org_id tashkilotiga kirish huquqiga ega ekanligini tekshiradi.
    Platform admin — barcha tashkilotlarga kiradi.
    """
    from backend.db.models.user import UserRole
    if current_user.role == UserRole.admin:
        return  # Platform admin — hamma joyga kiradi

    member = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    member = member.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=403, detail="Bu tashkilotga kirish ruxsati yo'q")

    if require_admin and member.role_in_org != "org_admin":
        raise HTTPException(status_code=403, detail="Org-admin roli kerak")
```

---

## 2.2 — Organization Schemas

**Fayl:** `backend/schemas/organization.py`

```python
import uuid
from pydantic import BaseModel, Field
from backend.db.models.organization import OrgType, OrgPlan, OrgStatus


class OrgRequestCreate(BaseModel):
    """So'rov yuborishda kerakli ma'lumotlar."""
    name: str = Field(..., min_length=2, max_length=255)
    type: OrgType
    address: str | None = None
    phone: str | None = None
    stir: str | None = None
    responsible_person: str  # Mas'ul shaxs FIO


class OrgRequestResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    org_data: dict
    status: str
    review_note: str | None
    organization_id: uuid.UUID | None
    model_config = {"from_attributes": True}


class OrgRequestReview(BaseModel):
    """Admin tomonidan tasdiqlash/rad etish."""
    action: str  # "approve" yoki "reject"
    note: str | None = None  # Rad etish sababi


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: OrgType
    plan: OrgPlan
    status: OrgStatus
    address: str | None
    phone: str | None
    ai_tokens_used: int
    ai_token_limit: int | None
    model_config = {"from_attributes": True}


class MemberCreate(BaseModel):
    """Tashkilotga a'zo qo'shish."""
    email: str
    full_name: str
    phone: str | None = None
    # Agar mavjud user bo'lsa — faqat user_id yuboring
    user_id: uuid.UUID | None = None
    # Yangi user yaratilsa — parol ham kerak
    password: str | None = None


class ParentLinkCreate(BaseModel):
    parent_id: uuid.UUID
    student_id: uuid.UUID
```

---

## 2.3 — Organization Repositories

**Fayl:** `backend/repositories/org_repo.py`

```python
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from backend.db.models.organization import (
    Organization, OrganizationRequest, OrganizationMember,
    OrganizationRequestStatus, OrgMemberRole
)
from backend.db.models.user import User, UserRole


class OrgRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_request(self, user_id: uuid.UUID, org_data: dict) -> OrganizationRequest:
        req = OrganizationRequest(user_id=user_id, org_data=org_data)
        self.db.add(req)
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def get_all_requests(self, status: str | None = None) -> list[OrganizationRequest]:
        q = select(OrganizationRequest)
        if status:
            q = q.where(OrganizationRequest.status == status)
        result = await self.db.execute(q.order_by(OrganizationRequest.created_at.desc()))
        return result.scalars().all()

    async def approve_request(
        self, request_id: uuid.UUID, admin_id: uuid.UUID
    ) -> tuple[Organization, OrganizationRequest]:
        """So'rovni tasdiqlash → Organization yaratish → user ga org_admin roli berish."""
        req = await self.db.get(OrganizationRequest, request_id)
        if not req or req.status != OrganizationRequestStatus.pending:
            raise ValueError("So'rov topilmadi yoki allaqachon ko'rib chiqilgan")

        # Tashkilot yaratish
        org = Organization(
            name=req.org_data["name"],
            type=req.org_data["type"],
            address=req.org_data.get("address"),
            phone=req.org_data.get("phone"),
            stir=req.org_data.get("stir"),
            owner_id=req.user_id,
        )
        self.db.add(org)
        await self.db.flush()  # org.id ni olish uchun

        # So'rovni yangilash
        req.status = OrganizationRequestStatus.approved
        req.reviewed_by = admin_id
        req.organization_id = org.id

        # Foydalanuvchiga org_admin roli berish
        user = await self.db.get(User, req.user_id)
        user.role = UserRole.org_admin
        user.org_id = org.id

        # Org member sifatida qo'shish
        member = OrganizationMember(
            org_id=org.id, user_id=req.user_id, role_in_org=OrgMemberRole.org_admin
        )
        self.db.add(member)

        await self.db.commit()
        return org, req

    async def reject_request(
        self, request_id: uuid.UUID, admin_id: uuid.UUID, note: str | None
    ) -> OrganizationRequest:
        req = await self.db.get(OrganizationRequest, request_id)
        req.status = OrganizationRequestStatus.rejected
        req.reviewed_by = admin_id
        req.review_note = note
        await self.db.commit()
        return req

    async def add_member(
        self, org_id: uuid.UUID, user: User, role: OrgMemberRole
    ) -> OrganizationMember:
        """Foydalanuvchini tashkilotga qo'shish."""
        user.org_id = org_id
        user.role = UserRole(role.value)  # user.role ni ham yangilash

        member = OrganizationMember(org_id=org_id, user_id=user.id, role_in_org=role)
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def get_org_members(self, org_id: uuid.UUID, role: OrgMemberRole | None = None):
        q = select(User).join(
            OrganizationMember,
            OrganizationMember.user_id == User.id
        ).where(OrganizationMember.org_id == org_id)
        if role:
            q = q.where(OrganizationMember.role_in_org == role)
        result = await self.db.execute(q)
        return result.scalars().all()
```

---

## 2.4 — Organization Routes

**Fayl:** `backend/api/routes/organizations.py`

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.api.deps import get_db, get_current_user, require_admin, require_org_admin
from backend.db.models.user import User, UserRole
from backend.repositories.org_repo import OrgRepository
from backend.repositories.user_repo import UserRepository
from backend.schemas.organization import (
    OrgRequestCreate, OrgRequestResponse, OrgRequestReview,
    OrganizationResponse, MemberCreate, ParentLinkCreate
)
from backend.db.models.organization import OrgMemberRole
from backend.db.models.parent_student import ParentStudent

router = APIRouter(prefix="/organizations", tags=["organizations"])


# ─── So'rovlar ───────────────────────────────────────────────────────────────

@router.post("/request", response_model=OrgRequestResponse)
async def create_org_request(
    body: OrgRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tashkilot yaratish so'rovi yuborish."""
    repo = OrgRepository(db)
    req = await repo.create_request(
        user_id=current_user.id,
        org_data=body.model_dump(),
    )
    return req


@router.get("/requests", response_model=list[OrgRequestResponse])
async def list_requests(
    status: str | None = None,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """[Admin] Barcha so'rovlar ro'yxati."""
    repo = OrgRepository(db)
    return await repo.get_all_requests(status=status)


@router.put("/requests/{request_id}", response_model=OrgRequestResponse)
async def review_request(
    request_id: uuid.UUID,
    body: OrgRequestReview,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """[Admin] So'rovni tasdiqlash yoki rad etish."""
    repo = OrgRepository(db)
    if body.action == "approve":
        org, req = await repo.approve_request(request_id, admin.id)
        return req
    elif body.action == "reject":
        req = await repo.reject_request(request_id, admin.id, body.note)
        return req
    raise HTTPException(status_code=400, detail="action: 'approve' yoki 'reject' bo'lishi kerak")


# ─── Tashkilot boshqaruvi ─────────────────────────────────────────────────────

@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db)
    org = await db.get(type(None), org_id)  # direct get
    from backend.db.models.organization import Organization
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Tashkilot topilmadi")
    return org


# ─── A'zolar boshqaruvi ────────────────────────────────────────────────────────

@router.post("/{org_id}/teachers", status_code=201)
async def add_teacher(
    org_id: uuid.UUID,
    body: MemberCreate,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """O'qituvchi yaratish yoki mavjud userni qo'shish."""
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db, require_admin=True)
    return await _add_member(org_id, body, OrgMemberRole.teacher, db)


@router.post("/{org_id}/students", status_code=201)
async def add_student(
    org_id: uuid.UUID,
    body: MemberCreate,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """O'quvchi yaratish yoki mavjud userni qo'shish."""
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db, require_admin=True)
    return await _add_member(org_id, body, OrgMemberRole.student, db)


@router.post("/{org_id}/parents", status_code=201)
async def add_parent(
    org_id: uuid.UUID,
    body: MemberCreate,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Ota-ona akkaunt yaratish."""
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db, require_admin=True)
    return await _add_member(org_id, body, OrgMemberRole.parent, db)


async def _add_member(
    org_id: uuid.UUID, body: MemberCreate, role: OrgMemberRole, db: AsyncSession
):
    """Umumiy a'zo qo'shish logikasi."""
    from backend.core.security import hash_password
    user_repo = UserRepository(db)
    org_repo = OrgRepository(db)

    if body.user_id:
        # Mavjud user ni qo'shish
        user = await user_repo.get_by_id(body.user_id)
    else:
        # Yangi user yaratish
        if not body.password:
            from fastapi import HTTPException
            raise HTTPException(400, "Yangi user uchun parol kerak")
        user = await user_repo.create(
            email=body.email,
            password_hash=hash_password(body.password),
            full_name=body.full_name,
            role=UserRole(role.value),
        )
    return await org_repo.add_member(org_id, user, role)


@router.post("/{org_id}/parent-links", status_code=201)
async def link_parent_student(
    org_id: uuid.UUID,
    body: ParentLinkCreate,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Ota-onani o'quvchiga biriktirish (org_admin tasdiqlaydi)."""
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db, require_admin=True)

    link = ParentStudent(
        parent_id=body.parent_id,
        student_id=body.student_id,
        org_id=org_id,
        is_confirmed=True,
        confirmed_by=current_user.id,
    )
    db.add(link)
    await db.commit()
    return {"status": "linked"}


# ─── A'zolar ko'rish ────────────────────────────────────────────────────────────

@router.get("/{org_id}/members")
async def list_members(
    org_id: uuid.UUID,
    role: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db)
    org_repo = OrgRepository(db)
    role_enum = OrgMemberRole(role) if role else None
    members = await org_repo.get_org_members(org_id, role_enum)
    return [{"id": m.id, "email": m.email, "full_name": m.full_name, "role": m.role} for m in members]
```

---

## 2.5 — Dashboard Org endpoint

`backend/api/routes/dashboard.py` ga qo'shish:

```python
@router.get("/org/{org_id}")
async def org_dashboard(
    org_id: uuid.UUID,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Org-admin dashboard: tashkilot statistikasi."""
    from backend.api.middleware.org_scope import verify_org_access
    await verify_org_access(org_id, current_user, db)

    from sqlalchemy import func, select
    from backend.db.models.organization import OrganizationMember
    from backend.db.models.class_ import Class
    from backend.db.models.course import Course

    # O'qituvchilar soni
    teachers_q = await db.execute(
        select(func.count()).select_from(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.role_in_org == "teacher"
        )
    )
    # O'quvchilar soni
    students_q = await db.execute(
        select(func.count()).select_from(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.role_in_org == "student"
        )
    )
    # Sinflar soni
    classes_q = await db.execute(
        select(func.count()).select_from(Class).where(Class.org_id == org_id)
    )
    # Kurslar soni
    courses_q = await db.execute(
        select(func.count()).select_from(Course).where(Course.org_id == org_id)
    )

    return {
        "org_id": str(org_id),
        "stats": {
            "teachers": teachers_q.scalar(),
            "students": students_q.scalar(),
            "classes": classes_q.scalar(),
            "courses": courses_q.scalar(),
        }
    }
```

---

## 2.6 — `main.py` ga router qo'shish

```python
from backend.api.routes import organizations
app.include_router(organizations.router, prefix="/api/v1")
```

---

## Muvaffaqiyat mezoni

- [ ] `POST /api/v1/organizations/request` — so'rov yuboriladi
- [ ] `GET /api/v1/organizations/requests` — admin barcha so'rovlarni ko'radi
- [ ] `PUT /api/v1/organizations/requests/{id}` body=`{"action":"approve"}` → user org_admin bo'ladi
- [ ] `POST /api/v1/organizations/{org_id}/teachers` — o'qituvchi yaratiladi
- [ ] `POST /api/v1/organizations/{org_id}/students` — o'quvchi yaratiladi
- [ ] Boshqa org ning ma'lumotlariga kirish → `403 Forbidden`
- [ ] `GET /api/v1/dashboard/org/{org_id}` — statistika qaytaradi
