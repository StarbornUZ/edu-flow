"""Kurslar va modullar endpointlari."""
import uuid

from fastapi import APIRouter, HTTPException, status

from backend.api.deps import CurrentTeacher, CurrentUser, DBSession
from backend.db.models.user import UserRole
from backend.repositories.course_repo import CourseRepository
from backend.schemas.course import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    ModuleCreate,
    ModuleResponse,
    ModuleUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _repo(db: DBSession) -> CourseRepository:
    return CourseRepository(db)


async def _get_course_or_404(repo: CourseRepository, course_id: uuid.UUID):
    course = await repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kurs topilmadi")
    return course


def _check_owner(course, user):
    """Faqat kurs egasi yoki admin o'zgartira oladi."""
    if course.teacher_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu kurs sizga tegishli emas")


async def _get_module_or_404(repo: CourseRepository, module_id: uuid.UUID):
    module = await repo.get_module(module_id)
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Modul topilmadi")
    return module


async def _check_course_access(repo: CourseRepository, course, user) -> None:
    """Kursga kirish huquqini tekshiradi.

    Admin  → har qanday kurs
    Teacher → faqat o'z kurslari (istalgan status)
    Student → faqat published + (to'g'ridan-to'g'ri yoki sinf orqali) yozilgan
    """
    if user.role == UserRole.admin:
        return

    if user.role == UserRole.teacher:
        if course.teacher_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu kurs sizga tegishli emas")
        return

    # Student
    if course.status != "published":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Kurs hali nashr etilmagan")

    enrolled = await repo.is_enrolled(course.id, user.id)
    if not enrolled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Siz bu kursga yozilmagansiz")


# ---------------------------------------------------------------------------
# GET /courses — ro'yxat (rol bo'yicha filter)
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[CourseResponse],
    summary="Kurslar ro'yxati (rol bo'yicha filter)",
)
async def list_courses(user: CurrentUser, db: DBSession):
    repo = _repo(db)
    if user.role == UserRole.student:
        courses = await repo.get_enrolled_by_student(user.id)
    elif user.role in (UserRole.teacher, UserRole.admin):
        courses = await repo.get_by_teacher(user.id)
    else:
        courses = await repo.get_published()
    return [CourseResponse.model_validate(c) for c in courses]


# ---------------------------------------------------------------------------
# POST /courses  — kurs yaratish (faqat teacher)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi kurs yaratish",
)
async def create_course(data: CourseCreate, teacher: CurrentTeacher, db: DBSession):
    course = await _repo(db).create(
        teacher_id=teacher.id,
        title=data.title,
        description=data.description,
        subject=data.subject,
        difficulty=data.difficulty,
        cover_url=data.cover_url,
        is_ai_generated=data.is_ai_generated,
    )
    return CourseResponse.model_validate(course)


# ---------------------------------------------------------------------------
# GET /courses/{id}
# ---------------------------------------------------------------------------

@router.get(
    "/{course_id}",
    response_model=CourseResponse,
    summary="Kurs ma'lumotlari",
)
async def get_course(course_id: uuid.UUID, user: CurrentUser, db: DBSession):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    await _check_course_access(repo, course, user)
    return CourseResponse.model_validate(course)


# ---------------------------------------------------------------------------
# PATCH /courses/{id}  — tahrirlash (faqat egasi)
# ---------------------------------------------------------------------------

@router.patch(
    "/{course_id}",
    response_model=CourseResponse,
    summary="Kurs ma'lumotlarini yangilash",
)
async def update_course(
    course_id: uuid.UUID,
    data: CourseUpdate,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    _check_owner(course, teacher)

    updates = data.model_dump(exclude_none=True)
    if not updates:
        return CourseResponse.model_validate(course)

    updated = await repo.update(course, **updates)
    return CourseResponse.model_validate(updated)


# ---------------------------------------------------------------------------
# DELETE /courses/{id}  — soft delete → arxiv
# ---------------------------------------------------------------------------

@router.delete(
    "/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Kursni arxivlash (soft delete)",
)
async def delete_course(
    course_id: uuid.UUID,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    _check_owner(course, teacher)
    await repo.archive(course)


# ---------------------------------------------------------------------------
# POST /courses/{id}/publish
# ---------------------------------------------------------------------------

@router.post(
    "/{course_id}/publish",
    response_model=CourseResponse,
    summary="Kursni nashr etish",
)
async def publish_course(
    course_id: uuid.UUID,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    _check_owner(course, teacher)

    published = await repo.publish(course)
    return CourseResponse.model_validate(published)


# ---------------------------------------------------------------------------
# GET /courses/{id}/modules
# ---------------------------------------------------------------------------

@router.get(
    "/{course_id}/modules",
    response_model=list[ModuleResponse],
    summary="Kurs modullari ro'yxati",
)
async def list_modules(course_id: uuid.UUID, user: CurrentUser, db: DBSession):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    await _check_course_access(repo, course, user)
    modules = await repo.get_modules(course_id)
    return [ModuleResponse.model_validate(m) for m in modules]


# ---------------------------------------------------------------------------
# POST /courses/{id}/modules
# ---------------------------------------------------------------------------

@router.post(
    "/{course_id}/modules",
    response_model=ModuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Kursga modul qo'shish",
)
async def add_module(
    course_id: uuid.UUID,
    data: ModuleCreate,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    _check_owner(course, teacher)

    module = await repo.add_module(
        course_id=course_id,
        title=data.title,
        content_md=data.content_md,
        order_number=data.order_number,
        prev_module_id=data.prev_module_id,
        is_published=data.is_published,
    )
    return ModuleResponse.model_validate(module)


# ---------------------------------------------------------------------------
# PATCH /courses/{id}/modules/{mid}
# ---------------------------------------------------------------------------

@router.patch(
    "/{course_id}/modules/{module_id}",
    response_model=ModuleResponse,
    summary="Modulni yangilash",
)
async def update_module(
    course_id: uuid.UUID,
    module_id: uuid.UUID,
    data: ModuleUpdate,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    _check_owner(course, teacher)

    module = await _get_module_or_404(repo, module_id)
    if module.course_id != course_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Modul bu kursga tegishli emas")

    updates = data.model_dump(exclude_none=True)
    updated = await repo.update_module(module, **updates)
    return ModuleResponse.model_validate(updated)


# ---------------------------------------------------------------------------
# DELETE /courses/{id}/modules/{mid}
# ---------------------------------------------------------------------------

@router.delete(
    "/{course_id}/modules/{module_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Modulni o'chirish",
)
async def delete_module(
    course_id: uuid.UUID,
    module_id: uuid.UUID,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    course = await _get_course_or_404(repo, course_id)
    _check_owner(course, teacher)

    module = await _get_module_or_404(repo, module_id)
    if module.course_id != course_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Modul bu kursga tegishli emas")

    await repo.delete_module(module)
