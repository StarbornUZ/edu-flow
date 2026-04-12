"""FastAPI dependency injection.

Foydalanish:
    @router.get("/me")
    async def get_me(user: CurrentUser):
        return user

    @router.post("/courses")
    async def create_course(db: DBSession, teacher: CurrentTeacher):
        ...
"""
from typing import Annotated, AsyncGenerator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import decode_token
from backend.db.session import get_session_factory
from backend.db.models.user import User, UserRole


# ---------------------------------------------------------------------------
# DB Session
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Har so'rov uchun yangi async DB sessiya yaratadi va so'rov tugagach yopadi."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


DBSession = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Auth — token extraction
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


async def _get_token(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
) -> str:
    """Authorization: Bearer <token> headeridan token oladi."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header yo'q yoki noto'g'ri",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials  # str — HTTPBearer tomonidan kafolatlangan


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

async def get_current_user(
        db: DBSession,
        token: Annotated[str, Depends(_get_token)],
) -> User:
    """JWT ni decode qilib, DB dan foydalanuvchini olib qaytaradi.

    Xatolar:
        401 — token noto'g'ri / muddati o'tgan
        401 — foydalanuvchi topilmadi
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token noto'g'ri yoki muddati o'tgan",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token muddati o'tgan",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise credentials_exc

    # Access token bo'lishi shart (refresh token qabul qilinmaydi)
    if payload.get("type") != "access":
        raise credentials_exc

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise credentials_exc

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Role-based guards
# ---------------------------------------------------------------------------

def _require_role(required_role: UserRole):
    """Rol tekshiradigan dependency factory."""

    async def _check(user: CurrentUser) -> User:
        if user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu amal faqat {required_role.value} uchun ruxsat etilgan",
            )
        return user

    return _check


async def _require_teacher_or_admin(user: CurrentUser) -> User:
    """Teacher, org_admin yoki admin bo'lishi kerak."""
    if user.role not in (UserRole.teacher, UserRole.admin, UserRole.org_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal faqat o'qituvchilar uchun ruxsat etilgan",
        )
    return user


async def _require_org_admin(user: CurrentUser) -> User:
    """Org_admin yoki admin bo'lishi kerak."""
    if user.role not in (UserRole.org_admin, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal faqat tashkilot administratorlari uchun ruxsat etilgan",
        )
    return user


async def _require_parent(user: CurrentUser) -> User:
    """Parent bo'lishi kerak."""
    if user.role != UserRole.parent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal faqat ota-onalar uchun ruxsat etilgan",
        )
    return user


CurrentTeacher = Annotated[User, Depends(_require_teacher_or_admin)]
CurrentStudent = Annotated[User, Depends(_require_role(UserRole.student))]
CurrentAdmin = Annotated[User, Depends(_require_role(UserRole.admin))]
CurrentOrgAdmin = Annotated[User, Depends(_require_org_admin)]
CurrentParent = Annotated[User, Depends(_require_parent)]
