import secrets
import uuid

from backend.core.security import (
    decode_token,
    generate_tokens,
    hash_password,
    hash_token,
    verify_password,
)
from backend.db.models import RefreshSession, User
from backend.repositories import RefreshSessionRepository, UserRepository


class AuthService:
    def __init__(self, users_repo: UserRepository, refresh_repo: RefreshSessionRepository):
        self.users_repo = users_repo
        self.refresh_repo = refresh_repo

    async def register(self, email: str, password: str, **data) -> tuple[User, tuple[str, str]]:
        existing = await self.users_repo.get_by_email(email)
        if existing:
            raise ValueError("Bu email allaqachon ro'yxatdan o'tgan")

        user = await self.users_repo.create(
            email=email,
            password_hash=hash_password(password),
            **data,
        )
        tokens = await self._create_session(user.id)
        return user, tokens

    async def login(self, email: str, password: str) -> tuple[User, tuple[str, str]]:
        user = await self.users_repo.get_by_email_or_username(email)
        if not user:
            # Timing attack oldini olish uchun dummy hashing
            hash_password("dummy_password_to_prevent_timing_attack")
            raise ValueError("Email, username yoki parol noto'g'ri")

        # FIX: verify_password(plain, hashed) — plain ni hash qilmaydi
        if not verify_password(password, user.password_hash):
            raise ValueError("Email yoki parol noto'g'ri")

        tokens = await self._create_session(user.id)
        return user, tokens

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        """Yangi access + refresh token juftini qaytaradi (token rotation)."""
        old_session = await self._validate_refresh_token(refresh_token)
        return await self._create_session(old_session.user_id, old_session)

    async def logout(self, refresh_token: str) -> None:
        """Refresh tokenni bekor qiladi (blacklist)."""
        session = await self._validate_refresh_token(refresh_token)
        await self.refresh_repo.revoke(session)

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    async def _validate_refresh_token(self, refresh_token: str) -> RefreshSession:
        try:
            payload = decode_token(refresh_token)
        except Exception:
            raise ValueError("Refresh token noto'g'ri yoki muddati o'tgan")

        if payload.get("type") != "refresh":
            raise ValueError("Noto'g'ri token turi")

        # FIX: JWT da kalit "sid", "session_id" emas
        session_id: str | None = payload.get("sid")
        if not session_id:
            raise ValueError("Token tarkibida session_id yo'q")

        token_hash = hash_token(refresh_token)
        session = await self.refresh_repo.get_valid_by_session_and_hash(session_id, token_hash)

        if not session:
            raise ValueError("Refresh token bekor qilingan yoki topilmadi")

        return session

    async def _create_session(
        self,
        user_id: uuid.UUID,
        old_session: RefreshSession | None = None,
    ) -> tuple[str, str]:
        """Yangi DB sessiya va token juftini yaratadi."""
        session_id = secrets.token_urlsafe(32)
        access_token, refresh_token = generate_tokens(session_id, user_id)

        new_session = await self.refresh_repo.create(
            session_id=session_id,
            user_id=user_id,
            token_hash=hash_token(refresh_token),
        )

        if old_session:
            # Token rotation: eski sessiyaniyg 'replaced_by' ga yangi ID yoziladi
            await self.refresh_repo.revoke(old_session, new_session.id)

        return access_token, refresh_token
