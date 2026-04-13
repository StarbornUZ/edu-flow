"""Auth endpointlari — ro'yxatdan o'tish, kirish, tokenlar, profil."""
from fastapi import APIRouter, HTTPException, status

from backend.api.deps import CurrentUser, DBSession
from backend.core.security import hash_password, verify_password
from backend.repositories import RefreshSessionRepository, UserRepository
from backend.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from backend.services.auth_service import AuthService

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _service(db: DBSession) -> AuthService:
    return AuthService(
        users_repo=UserRepository(db),
        refresh_repo=RefreshSessionRepository(db),
    )


def _http_error(detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


# ---------------------------------------------------------------------------
# PUBLIC endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi foydalanuvchi ro'yxatdan o'tkazish",
)
async def register(data: RegisterRequest, db: DBSession):
    try:
        user, (access_token, refresh_token) = await _service(db).register(
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            role=data.role,
        )
    except ValueError as e:
        raise _http_error(str(e), status.HTTP_409_CONFLICT)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Tizimga kirish va JWT tokenlar olish",
)
async def login(data: LoginRequest, db: DBSession):
    try:
        user, (access_token, refresh_token) = await _service(db).login(
            email=data.email,
            password=data.password,
        )
    except ValueError as e:
        # Login xatolarini birlashtirish (email/parol farqlanmasin)
        raise _http_error(str(e), status.HTTP_401_UNAUTHORIZED)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Yangi access token olish (token rotation)",
)
async def refresh(data: RefreshRequest, db: DBSession):
    try:
        access_token, refresh_token = await _service(db).refresh(data.refresh_token)
    except ValueError as e:
        raise _http_error(str(e), status.HTTP_401_UNAUTHORIZED)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ---------------------------------------------------------------------------
# AUTHENTICATED endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Chiqish — refresh tokenni bekor qilish",
)
async def logout(data: RefreshRequest, db: DBSession, _: CurrentUser):
    """Joriy sessiyani bekor qiladi. Access token muddati o'tguncha ishlay beradi."""
    try:
        await _service(db).logout(data.refresh_token)
    except ValueError as e:
        raise _http_error(str(e), status.HTTP_401_UNAUTHORIZED)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Joriy foydalanuvchi ma'lumotlari",
)
async def get_me(user: CurrentUser):
    return UserResponse.model_validate(user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Profil ma'lumotlarini yangilash (ism, avatar)",
)
async def update_me(data: UserUpdate, user: CurrentUser, db: DBSession):
    repo = UserRepository(db)
    updates = data.model_dump(exclude_none=True)
    if not updates:
        return UserResponse.model_validate(user)
    updated = await repo.update(user, **updates)
    return UserResponse.model_validate(updated)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Parolni o'zgartirish",
)
async def change_password(
    data: ChangePasswordRequest,
    user: CurrentUser,
    db: DBSession,
):
    if not verify_password(data.current_password, user.password_hash):
        raise _http_error("Joriy parol noto'g'ri", status.HTTP_400_BAD_REQUEST)

    repo = UserRepository(db)
    # system_password ni NULL qilamiz — foydalanuvchi o'zi o'zgartirdi
    await repo.update(user, password_hash=hash_password(data.new_password), system_password=None)
