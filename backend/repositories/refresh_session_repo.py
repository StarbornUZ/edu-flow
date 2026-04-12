import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import RefreshSession


class RefreshSessionRepository:
    def __init__(self, db_session: AsyncSession):
        self.session = db_session

    async def create(
            self,
            session_id: str,
            user_id: uuid.UUID,
            token_hash: str,
    ):
        refresh_session = RefreshSession(
            session_id=session_id,
            user_id=user_id,
            token_hash=token_hash,
        )
        self.session.add(refresh_session)
        await self.session.commit()
        await self.session.refresh(refresh_session)
        return refresh_session

    async def get_valid_by_session_and_hash(self, session_id: str, token_hash: str) -> RefreshSession | None:
        result = await self.session.execute(
            select(RefreshSession).where(
                RefreshSession.session_id == session_id,
                RefreshSession.token_hash == token_hash,
                RefreshSession.revoked_at.is_(None),
                RefreshSession.replaced_by_token_id.is_(None),
            )
        )

        return result.scalar_one_or_none()

    async def revoke(self, refresh_session: RefreshSession, replaced_by_token_id: uuid.UUID | None = None):
        refresh_session.revoked_at = func.now()
        if replaced_by_token_id:
            refresh_session.replaced_by_token_id = replaced_by_token_id
        await self.session.commit()
