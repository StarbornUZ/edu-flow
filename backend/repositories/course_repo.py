import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import or_, exists

from backend.db.models.course import Course, CourseModule, CourseEnrollment, CourseStatus
from backend.db.models.class_ import ClassEnrollment, ClassEnrollmentStatus


class CourseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Course CRUD
    # ------------------------------------------------------------------

    async def create(self, teacher_id: uuid.UUID, **data) -> Course:
        course = Course(teacher_id=teacher_id, **data)
        self.db.add(course)
        await self.db.commit()
        await self.db.refresh(course)
        return course

    async def get_by_id(self, course_id: uuid.UUID) -> Course | None:
        result = await self.db.execute(
            select(Course).where(Course.id == course_id)
        )
        return result.scalar_one_or_none()

    async def get_by_teacher(self, teacher_id: uuid.UUID) -> Sequence[Course]:
        result = await self.db.execute(
            select(Course).where(Course.teacher_id == teacher_id)
                          .order_by(Course.created_at.desc())
        )
        return result.scalars().all()

    async def get_published(self) -> Sequence[Course]:
        result = await self.db.execute(
            select(Course).where(Course.status == CourseStatus.published)
                          .order_by(Course.created_at.desc())
        )
        return result.scalars().all()

    async def is_enrolled(self, course_id: uuid.UUID, student_id: uuid.UUID) -> bool:
        """O'quvchi kursga yozilganmi?

        Ikkala holat tekshiriladi:
          1. To'g'ridan-to'g'ri: CourseEnrollment.student_id == student_id
          2. Sinf orqali:        CourseEnrollment.class_id → ClassEnrollment.student_id
                                 (butun sinf yozilgan, student_id=NULL bo'lgan qator)
        """
        # Sinf orqali yozilganlik subquery
        class_enrollment_exists = (
            select(ClassEnrollment.id)
            .where(
                ClassEnrollment.class_id == CourseEnrollment.class_id,
                ClassEnrollment.student_id == student_id,
                ClassEnrollment.status == ClassEnrollmentStatus.active,
            )
            .correlate(CourseEnrollment)
        )

        result = await self.db.execute(
            select(CourseEnrollment.id).where(
                CourseEnrollment.course_id == course_id,
                or_(
                    # Yo'l 1: to'g'ridan-to'g'ri enrollment
                    CourseEnrollment.student_id == student_id,
                    # Yo'l 2: sinf orqali enrollment (student_id=NULL)
                    (
                        CourseEnrollment.student_id.is_(None)
                        & exists(class_enrollment_exists)
                    ),
                ),
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def get_enrolled_by_student(self, student_id: uuid.UUID) -> Sequence[Course]:
        result = await self.db.execute(
            select(Course)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .where(CourseEnrollment.student_id == student_id)
            .order_by(Course.created_at.desc())
        )
        return result.scalars().all()

    async def update(self, course: Course, **fields) -> Course:
        for key, value in fields.items():
            setattr(course, key, value)
        await self.db.commit()
        await self.db.refresh(course)
        return course

    async def publish(self, course: Course) -> Course:
        course.status = CourseStatus.published
        await self.db.commit()
        await self.db.refresh(course)
        return course

    async def archive(self, course: Course) -> Course:
        """Soft delete — o'chirish o'rniga arxivlash."""
        course.status = CourseStatus.archived
        await self.db.commit()
        await self.db.refresh(course)
        return course

    # ------------------------------------------------------------------
    # Module CRUD
    # ------------------------------------------------------------------

    async def add_module(self, course_id: uuid.UUID, **data) -> CourseModule:
        module = CourseModule(course_id=course_id, **data)
        self.db.add(module)
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def get_module(self, module_id: uuid.UUID) -> CourseModule | None:
        result = await self.db.execute(
            select(CourseModule).where(CourseModule.id == module_id)
        )
        return result.scalar_one_or_none()

    async def get_modules(self, course_id: uuid.UUID) -> Sequence[CourseModule]:
        result = await self.db.execute(
            select(CourseModule).where(CourseModule.course_id == course_id)
                                .order_by(CourseModule.order_number)
        )
        return result.scalars().all()

    async def update_module(self, module: CourseModule, **fields) -> CourseModule:
        for key, value in fields.items():
            setattr(module, key, value)
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def delete_module(self, module: CourseModule) -> None:
        await self.db.delete(module)
        await self.db.commit()
