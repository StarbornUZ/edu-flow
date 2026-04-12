"""AILog repository — Claude API audit yozuvlarini boshqaradi."""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.submission import AILog


class AILogRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        endpoint: str,
        prompt_hash: str,
        user_id: uuid.UUID | None = None,
        tokens_used: int | None = None,
        response_ms: int | None = None,
    ) -> AILog:
        entry = AILog(
            user_id=user_id,
            endpoint=endpoint,
            prompt_hash=prompt_hash,
            tokens_used=tokens_used,
            response_ms=response_ms,
        )
        self.db.add(entry)
        await self.db.commit()
        return entry
