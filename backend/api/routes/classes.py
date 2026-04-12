"""Sinflar endpointlari."""
import uuid

from fastapi import APIRouter, HTTPException, status

from backend.api.deps import CurrentStudent, CurrentTeacher, CurrentUser, DBSession
from backend.db.models.course import CourseEnrollment
from backend.db.models.user import UserRole
from backend.repositories.class_repo import ClassRepository
from backend.repositories.course_repo import CourseRepository
from backend.schemas.class_ import (
    ClassCreate,
    ClassEnrollmentResponse,
    ClassResponse,
    ClassUpdate,
    EnrollCourseRequest,
    JoinClassRequest,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _repo(db: DBSession) -> ClassRepository:
    return ClassRepository(db)


async def _get_class_or_404(repo: ClassRepository, class_id: uuid.UUID):
    cls = await repo.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sinf topilmadi")
    return cls


def _check_owner(cls, teacher):
    if cls.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu sinf sizga tegishli emas")


async def _check_class_access(repo: ClassRepository, cls, user) -> None:
    """Sinfga kirish huquqini tekshiradi.

    Admin   → har qanday sinf
    Teacher → faqat o'z sinflari
    Student → faqat a'zo bo'lgan sinflari
    """
    if user.role == UserRole.admin:
        return
    if user.role == UserRole.teacher:
        if cls.teacher_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu sinf sizga tegishli emas")
        return
    # Student
    member = await repo.is_member(cls.id, user.id)
    if not member:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Siz bu sinfga a'zo emassiz")


# ---------------------------------------------------------------------------
# GET /classes  — ro'yxat (rol bo'yicha)
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[ClassResponse],
    summary="Sinflar ro'yxati (teacher: o'z sinflari, student: a'zo sinflari)",
)
async def list_classes(user: CurrentUser, db: DBSession):
    repo = _repo(db)
    if user.role == UserRole.student:
        classes = await repo.get_enrolled_by_student(user.id)
    else:  # teacher yoki admin
        classes = await repo.get_by_teacher(user.id)
    return [ClassResponse.model_validate(c) for c in classes]


# ---------------------------------------------------------------------------
# POST /classes  — sinf yaratish (faqat teacher)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=ClassResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi sinf yaratish (6 belgili kod avtomatik)",
)
async def create_class(data: ClassCreate, teacher: CurrentTeacher, db: DBSession):
    cls = await _repo(db).create(
        teacher_id=teacher.id,
        name=data.name,
        subject=data.subject,
        academic_year=data.academic_year,
    )
    return ClassResponse.model_validate(cls)


# ---------------------------------------------------------------------------
# POST /classes/join  — o'quvchi sinf kodini kiritib a'zo bo'ladi
# ---------------------------------------------------------------------------

@router.post(
    "/join",
    response_model=ClassEnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sinf kodini kiritib a'zo bo'lish (student)",
)
async def join_class(data: JoinClassRequest, student: CurrentStudent, db: DBSession):
    repo = _repo(db)
    cls = await repo.get_by_code(data.class_code)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sinf kodi noto'g'ri yoki muddati o'tgan")

    existing = await repo.get_enrollment(cls.id, student.id)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Siz allaqachon bu sinfdasiz")

    enrollment = await repo.enroll_student(cls.id, student.id)
    return ClassEnrollmentResponse.model_validate(enrollment)


# ---------------------------------------------------------------------------
# GET /classes/{id}  — sinf ma'lumotlari
# ---------------------------------------------------------------------------

@router.get(
    "/{class_id}",
    response_model=ClassResponse,
    summary="Sinf ma'lumotlari (egasi yoki a'zo bo'lgan student)",
)
async def get_class(class_id: uuid.UUID, user: CurrentUser, db: DBSession):
    repo = _repo(db)
    cls = await _get_class_or_404(repo, class_id)
    await _check_class_access(repo, cls, user)
    return ClassResponse.model_validate(cls)


# ---------------------------------------------------------------------------
# PATCH /classes/{id}  — sinf tahrirlash (faqat teacher-egasi)
# ---------------------------------------------------------------------------

@router.patch(
    "/{class_id}",
    response_model=ClassResponse,
    summary="Sinf ma'lumotlarini yangilash",
)
async def update_class(
    class_id: uuid.UUID,
    data: ClassUpdate,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    cls = await _get_class_or_404(repo, class_id)
    _check_owner(cls, teacher)

    updates = data.model_dump(exclude_none=True)
    if updates:
        for k, v in updates.items():
            setattr(cls, k, v)
        await db.commit()
        await db.refresh(cls)

    return ClassResponse.model_validate(cls)


# ---------------------------------------------------------------------------
# GET /classes/{id}/students  — sinfdoshlar ro'yxati
# ---------------------------------------------------------------------------

@router.get(
    "/{class_id}/students",
    response_model=list[ClassEnrollmentResponse],
    summary="Sinfdagi o'quvchilar (teacher: to'liq, student: o'z sinfdoshlari)",
)
async def list_students(
    class_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
):
    repo = _repo(db)
    cls = await _get_class_or_404(repo, class_id)
    await _check_class_access(repo, cls, user)   # teacher-egasi yoki a'zo student

    enrollments = await repo.get_students(class_id)
    return [ClassEnrollmentResponse.model_validate(e) for e in enrollments]


# ---------------------------------------------------------------------------
# POST /classes/{id}/enroll  — kursni butun sinfga biriktirish
# ---------------------------------------------------------------------------

@router.post(
    "/{class_id}/enroll",
    status_code=status.HTTP_201_CREATED,
    summary="Kursni butun sinfga biriktirish (bitta qator, student_id=NULL)",
)
async def enroll_class_to_course(
    class_id: uuid.UUID,
    data: EnrollCourseRequest,
    teacher: CurrentTeacher,
    db: DBSession,
):
    from sqlalchemy import select

    repo = _repo(db)
    cls = await _get_class_or_404(repo, class_id)
    _check_owner(cls, teacher)

    course = await CourseRepository(db).get_by_id(data.course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kurs topilmadi")

    existing = await db.execute(
        select(CourseEnrollment.id).where(
            CourseEnrollment.course_id == data.course_id,
            CourseEnrollment.class_id == class_id,
            CourseEnrollment.student_id.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu sinf allaqachon bu kursga biriktirilgan")

    enrollment = CourseEnrollment(
        course_id=data.course_id,
        class_id=class_id,
        student_id=None,
        deadline=data.deadline,
        enrolled_by=teacher.id,
    )
    db.add(enrollment)
    await db.commit()

    return {
        "course_id": str(data.course_id),
        "class_id": str(class_id),
        "message": f"'{cls.name}' sinfi '{course.title}' kursiga biriktirildi",
    }


# ---------------------------------------------------------------------------
# POST /classes/{id}/refresh-code  — yangi 24 soatlik kod
# ---------------------------------------------------------------------------

@router.post(
    "/{class_id}/refresh-code",
    response_model=ClassResponse,
    summary="Sinf kodini yangilash (yangi 24 soatlik kod)",
)
async def refresh_class_code(
    class_id: uuid.UUID,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    cls = await _get_class_or_404(repo, class_id)
    _check_owner(cls, teacher)
    updated = await repo.refresh_code(cls)
    return ClassResponse.model_validate(updated)


# ---------------------------------------------------------------------------
# DELETE /classes/{id}/students/{student_id}  — o'quvchini chiqarish
# ---------------------------------------------------------------------------

@router.delete(
    "/{class_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="O'quvchini sinfdan chiqarish",
)
async def remove_student(
    class_id: uuid.UUID,
    student_id: uuid.UUID,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    cls = await _get_class_or_404(repo, class_id)
    _check_owner(cls, teacher)

    removed = await repo.remove_student(class_id, student_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "O'quvchi bu sinfda topilmadi")
