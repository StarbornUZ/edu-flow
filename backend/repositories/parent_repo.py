"""Ota-ona (Parent-Student) repository."""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.parent_student import ParentStudent
from backend.db.models.user import User


class ParentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_student_parents(self, student_id: uuid.UUID) -> list[tuple[ParentStudent, User]]:
        """O'quvchiga biriktirilgan ota-onalar ro'yxati (foydalanuvchi ma'lumotlari bilan)."""
        result = await self.db.execute(
            select(ParentStudent, User)
            .join(User, User.id == ParentStudent.parent_id)
            .where(ParentStudent.student_id == student_id)
            .order_by(ParentStudent.created_at.desc())
        )
        return list(result.all())

    async def get_link(self, student_id: uuid.UUID, parent_id: uuid.UUID) -> ParentStudent | None:
        """Mavjud bog'lanishni tekshiradi."""
        result = await self.db.execute(
            select(ParentStudent).where(
                ParentStudent.student_id == student_id,
                ParentStudent.parent_id == parent_id,
            )
        )
        return result.scalar_one_or_none()

    async def assign_parent(
        self,
        org_id: uuid.UUID,
        student_id: uuid.UUID,
        parent_id: uuid.UUID,
        confirmed_by: uuid.UUID,
    ) -> ParentStudent:
        """O'quvchiga ota-ona biriktiradi."""
        link = ParentStudent(
            org_id=org_id,
            student_id=student_id,
            parent_id=parent_id,
            is_confirmed=True,
            confirmed_by=confirmed_by,
        )
        self.db.add(link)
        await self.db.commit()
        await self.db.refresh(link)
        return link

    async def remove_parent(self, student_id: uuid.UUID, parent_id: uuid.UUID) -> bool:
        """Ota-ona bog'lanishini o'chiradi."""
        link = await self.get_link(student_id, parent_id)
        if not link:
            return False
        await self.db.delete(link)
        await self.db.commit()
        return True
