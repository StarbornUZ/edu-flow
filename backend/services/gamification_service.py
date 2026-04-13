"""Gamification servisi — XP, level, streak, achievement.

Submission tasdiqlangandan keyin chaqiriladi:
  await GamificationService(db).process_submission(submission, results)

XP jadvali:
  MCQ/Fill/Matching/Ordering — birinchi urinish: 30 XP, ikkinchi: 15 XP
  Open answer               — to'liq ball: 50 XP, qisman: nisbiy
  Streak bonus              — har kunlik: 10 XP qo'shimcha

Achievement trigger:
  streak_3  — 3 kun ketma-ket
  streak_7  — 7 kun ketma-ket
  streak_30 — 30 kun ketma-ket
  level_2..6 — yangi darajaga chiqilganda
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.submission import Achievement, Submission, SubmissionResult
from backend.db.models.user import User

# ---------------------------------------------------------------------------
# Konstantalar
# ---------------------------------------------------------------------------

XP_MCQ_FIRST  = 30    # Birinchi urinishda to'g'ri
XP_MCQ_RETRY  = 15    # Keyingi urinishlarda to'g'ri
XP_OPEN_MAX   = 50    # Open answer uchun maksimal XP
XP_STREAK     = 10    # Kunlik streak bonusi

LEVEL_THRESHOLDS = [0, 500, 1_500, 3_500, 7_000, 15_000]  # index = level-1

STREAK_BADGES = {3: "streak_3", 7: "streak_7", 30: "streak_30"}
LEVEL_BADGES  = {2: "level_2", 3: "level_3", 4: "level_4", 5: "level_5", 6: "level_6"}


def calculate_level(xp: int) -> int:
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS, start=1):
        if xp >= threshold:
            level = i
    return level


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class GamificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Asosiy metod — submission natijalari bo'yicha XP + streak + badge
    # ------------------------------------------------------------------

    async def process_submission(
        self,
        submission: Submission,
        results: Sequence[SubmissionResult],
        attempt_num: int = 1,
    ) -> dict:
        """Submission uchun XP hisoblaydi, streakni yangilaydi, achievement tekshiradi.

        Returns:
            {"xp_earned": int, "new_level": int | None, "new_badges": list[str]}
        """
        user: User | None = await self.db.get(User, submission.student_id)
        if not user:
            return {"xp_earned": 0, "new_level": None, "new_badges": []}

        # 1. XP hisoblash
        total_xp = self._calc_xp(results, attempt_num)

        # 2. Streak yangilash + bonus
        streak_updated, streak_bonus = await self._update_streak(user)
        if streak_bonus:
            total_xp += XP_STREAK

        # 3. XP qo'shish va level tekshirish
        old_level = int(user.level)
        user.xp = max(0, int(user.xp) + total_xp)
        user.level = calculate_level(int(user.xp))
        new_level = int(user.level) if int(user.level) > old_level else None

        # 4. Achievement tekshirish
        new_badges: list[str] = []
        if streak_updated:
            badge = await self._check_streak_badge(user)
            if badge:
                new_badges.append(badge)
        if new_level is not None:
            badge = await self._check_level_badge(user, new_level)
            if badge:
                new_badges.append(badge)

        await self.db.commit()

        return {
            "xp_earned": total_xp,
            "new_level": new_level,
            "new_badges": new_badges,
        }

    # ------------------------------------------------------------------
    # XP hisoblash
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_xp(results: Sequence[SubmissionResult], attempt_num: int) -> int:
        total = 0
        for r in results:
            if r.is_correct is None:
                # open_answer — AI baholash bo'yicha
                if r.ai_score is not None and r.ai_score > 0:
                    # Qisman ball: max 50 XP ga nisbiy
                    xp = int(r.xp_earned) if r.xp_earned else 0
                    total += xp
            elif r.is_correct:
                if attempt_num == 1:
                    total += XP_MCQ_FIRST
                else:
                    total += XP_MCQ_RETRY
        return total

    # ------------------------------------------------------------------
    # Streak yangilash
    # ------------------------------------------------------------------

    @staticmethod
    async def _update_streak(user: User) -> tuple[bool, bool]:
        """(streak_yangilandi, bonus_xp_beriladimi) qaytaradi."""
        today = date.today()

        if user.streak_last_date is None:
            user.streak_count = 1
            user.streak_last_date = today
            return True, False

        if user.streak_last_date == today:
            return False, False  # Bugun allaqachon

        if user.streak_last_date == today - timedelta(days=1):
            user.streak_count = int(user.streak_count) + 1
            user.streak_last_date = today
            return True, True   # Ketma-ket + bonus

        # Gap — reset
        user.streak_count = 1
        user.streak_last_date = today
        return True, False

    # ------------------------------------------------------------------
    # Achievement triggerlar
    # ------------------------------------------------------------------

    async def _check_streak_badge(self, user: User) -> str | None:
        for days, badge_type in STREAK_BADGES.items():
            if int(user.streak_count) == days:
                return await self._award_badge(uuid.UUID(str(user.id)), badge_type, {"streak_days": days})
        return None

    async def _check_level_badge(self, user: User, new_level: int) -> str | None:
        badge_type = LEVEL_BADGES.get(new_level)
        if badge_type:
            return await self._award_badge(uuid.UUID(str(user.id)), badge_type, {"level": new_level})
        return None

    async def _award_badge(
        self,
        user_id: uuid.UUID,
        badge_type: str,
        metadata: dict,
    ) -> str | None:
        """Badge allaqachon berilganmi tekshiradi; yo'q bo'lsa yaratadi."""
        existing = await self.db.execute(
            select(Achievement).where(
                Achievement.user_id == user_id,
                Achievement.badge_type == badge_type,
            )
        )
        if existing.scalar_one_or_none():
            return None  # Allaqachon bor

        badge = Achievement(
            user_id=user_id,
            badge_type=badge_type,
            metadata_json=metadata,
        )
        self.db.add(badge)
        return badge_type

    # ------------------------------------------------------------------
    # Live session uchun XP (streak yangilanmaydi, badge tekshiriladi)
    # ------------------------------------------------------------------

    async def award_xp_live(self, student_id: uuid.UUID, xp_amount: int) -> None:
        """Jonli dars savoli uchun XP berish. Streak yangilanmaydi."""
        if xp_amount <= 0:
            return
        user: User | None = await self.db.get(User, student_id)
        if not user:
            return
        old_level = int(user.level)
        user.xp = int(user.xp) + xp_amount
        user.level = calculate_level(int(user.xp))
        if user.level > old_level:
            await self._check_level_badge(user, user.level)
        await self.db.commit()

    # ------------------------------------------------------------------
    # Alohida metod: faqat XP qo'shish (teacher confirm dan keyin)
    # ------------------------------------------------------------------

    async def award_xp_for_confirmed(
        self,
        student_id: uuid.UUID,
        xp_amount: int,
    ) -> dict:
        """Teacher open_answer ni tasdiqlagach chaqiriladi."""
        user: User | None = await self.db.get(User, student_id)
        if not user:
            return {"xp_earned": 0, "new_level": None}

        old_level = int(user.level)
        user.xp = max(0, int(user.xp) + xp_amount)
        user.level = calculate_level(int(user.xp))
        new_level = int(user.level) if int(user.level) > old_level else None

        if new_level is not None:
            badge_type = LEVEL_BADGES.get(new_level)
            if badge_type:
                await self._award_badge(uuid.UUID(str(user.id)), badge_type, {"level": new_level})

        await self.db.commit()
        return {"xp_earned": xp_amount, "new_level": new_level}
