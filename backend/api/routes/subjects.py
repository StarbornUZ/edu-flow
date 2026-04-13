"""Fan (Subject) endpointlari."""
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.api.deps import CurrentUser, DBSession
from backend.db.models.subject import Subject
from backend.db.models.user import UserRole
from backend.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate

router = APIRouter()


async def _get_subject_or_404(db: DBSession, subject_id: uuid.UUID) -> Subject:
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fan topilmadi")
    return subject


# ---------------------------------------------------------------------------
# GET /subjects — barcha fanlar (global + org)
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[SubjectResponse],
    summary="Fanlar ro'yxati",
)
async def list_subjects(user: CurrentUser, db: DBSession):
    query = select(Subject).order_by(Subject.name)

    # Student/teacher — global (is_default=True) yoki o'z org fanlari
    if user.role not in (UserRole.admin,):
        from sqlalchemy import or_
        query = query.where(
            or_(
                Subject.is_default.is_(True),
                Subject.org_id == user.org_id if user.org_id else Subject.is_default.is_(True),
            )
        )

    result = await db.execute(query)
    subjects = result.scalars().all()
    return [SubjectResponse.model_validate(s) for s in subjects]


# ---------------------------------------------------------------------------
# POST /subjects — fan yaratish (admin yoki org_admin)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi fan yaratish",
)
async def create_subject(data: SubjectCreate, user: CurrentUser, db: DBSession):
    if user.role not in (UserRole.admin, UserRole.org_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Faqat admin yoki org_admin")

    subject = Subject(
        name=data.name,
        description=data.description,
        icon=data.icon,
        is_default=data.is_default if user.role == UserRole.admin else False,
        org_id=data.org_id,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return SubjectResponse.model_validate(subject)


# ---------------------------------------------------------------------------
# GET /subjects/{id}
# ---------------------------------------------------------------------------

@router.get(
    "/{subject_id}",
    response_model=SubjectResponse,
    summary="Fan ma'lumotlari",
)
async def get_subject(subject_id: uuid.UUID, user: CurrentUser, db: DBSession):
    subject = await _get_subject_or_404(db, subject_id)
    return SubjectResponse.model_validate(subject)


# ---------------------------------------------------------------------------
# PATCH /subjects/{id} — admin
# ---------------------------------------------------------------------------

@router.patch(
    "/{subject_id}",
    response_model=SubjectResponse,
    summary="Fan ma'lumotlarini yangilash (admin)",
)
async def update_subject(
    subject_id: uuid.UUID,
    data: SubjectUpdate,
    user: CurrentUser,
    db: DBSession,
):
    subject = await _get_subject_or_404(db, subject_id)
    if user.role == UserRole.org_admin:
        if subject.org_id != user.org_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu fan sizning tashkilotingizga tegishli emas")
    elif user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Faqat admin yoki org_admin")
    updates = data.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(subject, key, value)
    await db.commit()
    await db.refresh(subject)
    return SubjectResponse.model_validate(subject)


# ---------------------------------------------------------------------------
# DELETE /subjects/{id} — admin
# ---------------------------------------------------------------------------

@router.delete(
    "/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Fanni o'chirish (admin)",
)
async def delete_subject(subject_id: uuid.UUID, user: CurrentUser, db: DBSession):
    subject = await _get_subject_or_404(db, subject_id)
    if user.role == UserRole.org_admin:
        if subject.org_id != user.org_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu fan sizning tashkilotingizga tegishli emas")
    elif user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Faqat admin yoki org_admin")
    await db.delete(subject)
    await db.commit()
