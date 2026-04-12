import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.class_ import Class, ClassEnrollment, ClassEnrollmentStatus

CODE_TTL_HOURS = 24


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _new_expires_at() -> datetime:
    return _now_utc() + timedelta(hours=CODE_TTL_HOURS)


def generate_class_code() -> str:
    """6 belgili tasodifiy sinf kodi (A-Z + 0-9)."""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(6))


class ClassRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Class CRUD
    # ------------------------------------------------------------------

    async def create(self, teacher_id: uuid.UUID, **data) -> Class:
        """Sinf yaratadi va 24 soatlik class_code beradi."""
        code = generate_class_code()          # boshlang'ich qiymat
        for _ in range(10):
            code = generate_class_code()
            if not await self._code_exists(code):
                break

        cls = Class(
            teacher_id=teacher_id,
            class_code=code,
            class_code_expires_at=_new_expires_at(),
            **data,
        )
        self.db.add(cls)
        await self.db.commit()
        await self.db.refresh(cls)
        return cls

    async def get_by_id(self, class_id: uuid.UUID) -> Class | None:
        result = await self.db.execute(
            select(Class).where(Class.id == class_id)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Class | None:
        """Kodni topadi — muddati o'tgan bo'lsa None qaytaradi."""
        result = await self.db.execute(
            select(Class).where(
                Class.class_code == code.upper(),
                Class.class_code_expires_at > _now_utc(),   # ← aktiv tekshiruvi
            )
        )
        return result.scalar_one_or_none()

    async def get_by_teacher(self, teacher_id: uuid.UUID) -> Sequence[Class]:
        result = await self.db.execute(
            select(Class).where(Class.teacher_id == teacher_id)
                         .order_by(Class.created_at.desc())
        )
        return result.scalars().all()

    async def get_enrolled_by_student(self, student_id: uuid.UUID) -> Sequence[Class]:
        """O'quvchi a'zo bo'lgan sinflar ro'yxati."""
        result = await self.db.execute(
            select(Class)
            .join(ClassEnrollment, ClassEnrollment.class_id == Class.id)
            .where(
                ClassEnrollment.student_id == student_id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
            .order_by(Class.created_at.desc())
        )
        return result.scalars().all()

    async def is_member(self, class_id: uuid.UUID, student_id: uuid.UUID) -> bool:
        """O'quvchi sinfda a'zomi?"""
        result = await self.db.execute(
            select(ClassEnrollment.id).where(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.student_id == student_id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
        )
        return result.scalar_one_or_none() is not None

    async def refresh_code(self, cls: Class) -> Class:
        """Yangi 24 soatlik kod beradi (eski kod o'chiriladi)."""
        code = generate_class_code()          # boshlang'ich qiymat
        for _ in range(10):
            code = generate_class_code()
            if not await self._code_exists(code, exclude_id=cls.id):
                break

        cls.class_code = code
        cls.class_code_expires_at = _new_expires_at()
        await self.db.commit()
        await self.db.refresh(cls)
        return cls

    # ------------------------------------------------------------------
    # Enrollment
    # ------------------------------------------------------------------

    async def get_enrollment(
        self, class_id: uuid.UUID, student_id: uuid.UUID
    ) -> ClassEnrollment | None:
        result = await self.db.execute(
            select(ClassEnrollment).where(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.student_id == student_id,
            )
        )
        return result.scalar_one_or_none()

    async def enroll_student(
        self, class_id: uuid.UUID, student_id: uuid.UUID
    ) -> ClassEnrollment:
        enrollment = ClassEnrollment(
            class_id=class_id,
            student_id=student_id,
            status=ClassEnrollmentStatus.active,
        )
        self.db.add(enrollment)
        await self.db.commit()
        await self.db.refresh(enrollment)
        return enrollment

    async def get_students(self, class_id: uuid.UUID) -> Sequence[ClassEnrollment]:
        result = await self.db.execute(
            select(ClassEnrollment).where(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
        )
        return result.scalars().all()

    async def remove_student(
        self, class_id: uuid.UUID, student_id: uuid.UUID
    ) -> bool:
        enrollment = await self.get_enrollment(class_id, student_id)
        if not enrollment:
            return False
        enrollment.status = ClassEnrollmentStatus.inactive
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _code_exists(
        self, code: str, exclude_id: uuid.UUID | None = None
    ) -> bool:
        """Kod boshqa sinfda ishlatilayotganini tekshiradi."""
        q = select(Class.id).where(Class.class_code == code)
        if exclude_id:
            q = q.where(Class.id != exclude_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none() is not None
