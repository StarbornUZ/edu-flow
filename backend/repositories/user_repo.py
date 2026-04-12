import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import User

# XP thresholds for each level (index = level - 1)
_LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7000, 15_000]


def _calculate_level(xp: int) -> int:
    level = 1
    for i, threshold in enumerate(_LEVEL_THRESHOLDS, start=1):
        if xp >= threshold:
            level = i
    return level


class UserRepository:
    def __init__(self, db_session: AsyncSession):
        self.session = db_session

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, email: str, password_hash: str, **data) -> User:
        user = User(email=email, password_hash=password_hash, **data)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user: User, **fields) -> User:
        """Berilgan maydonlarni yangilaydi."""
        for key, value in fields.items():
            setattr(user, key, value)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_xp(self, user_id: uuid.UUID, xp_delta: int) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} topilmadi")
        user.xp = max(0, user.xp + xp_delta)
        user.level = _calculate_level(user.xp)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_streak(self, user_id: uuid.UUID) -> User:
        """Kunlik streak ni yangilaydi (Duolingo uslubida).

        - Bugun allaqachon yangilangan → o'zgarmaydi
        - Kechagi kun → streak + 1
        - 2 kun va undan oldin → streak 1 ga reset
        """
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} topilmadi")

        today = date.today()

        if user.streak_last_date is None:
            user.streak_count = 1
        elif user.streak_last_date == today:
            # Bugun allaqachon qayd etilgan — hech narsa o'zgarmaydi
            return user
        elif user.streak_last_date == today - timedelta(days=1):
            user.streak_count += 1
        else:
            # Gap bor — streak uzildi
            user.streak_count = 1

        user.streak_last_date = today
        await self.session.commit()
        await self.session.refresh(user)
        return user
