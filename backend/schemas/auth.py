import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str  # "teacher" | "student"

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Parol kamida 8 ta belgidan iborat bo'lishi kerak")
        return v

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("teacher", "student", "admin", "org_admin", "parent"):
            raise ValueError("Rol faqat 'teacher', 'student', 'admin', 'org_admin' yoki 'parent' bo'lishi mumkin")
        return v


class LoginRequest(BaseModel):
    email: str  # email yoki username qabul qilinadi
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    avatar_url: str | None = None
    xp: int
    level: int
    streak_count: int
    org_id: uuid.UUID | None = None
    username: str | None = None
    phone: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Register va login uchun — foydalanuvchi + tokenlar birga."""
    user: UserResponse
    tokens: TokenResponse
