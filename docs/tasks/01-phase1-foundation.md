# Faza 1 — Foundation: DB Schema + Auth
> **Mas'ul:** Muxtorov Javohirbek
> **Vaqt:** Kun 1 · 09:00–11:00 (~2 soat)
> **Bloklovchi:** Faza 2, 3, 6 bu fazani kutadi

---

## Kontekst

Bu faza butun backend uchun asos. Yangi TZ v3 da 5 ta rol (admin, org_admin, teacher, student, parent) va yangi modellar bor. Mavjud `user.py`, `course.py`, `class_.py` modellarini yangilash va yangi modellarni qo'shish kerak.

**Muhim:** Alembic migration yozishdan OLDIN barcha modellar tayyor bo'lishi kerak — aks holda bir necha marta migration qilishga to'g'ri keladi.

---

## Faza 0 — Setup (Kun 1, 08:00–09:00)

```bash
# Repo clone
git clone <repo_url> && cd starborn-eduflow

# Virtual environment
uv sync

# .env to'ldirish (.env.example asosida)
cp .env.example .env
```

**.env kerakli maydonlar:**
```env
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@HOST:5432/eduflow
SECRET_KEY=<python -c "import secrets; print(secrets.token_hex(32))">
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...              # GPT-4o fallback uchun
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_MINUTES=10080  # 7 kun
ALGORITHM=HS256
FRONTEND_URL=https://eduflow.vercel.app
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
```

**Tekshirish:**
```bash
# DB ulanishi
python -c "import asyncio; from backend.db.session import AsyncSessionLocal; asyncio.run(AsyncSessionLocal().close()); print('DB OK')"

# Health check
uvicorn backend.main:app --reload
curl http://localhost:8000/health  # → {"status": "ok"}
```

---

## 1.1 — UserRole yangilash

**Fayl:** `backend/db/models/user.py`

Mavjud `UserRole` ga yangi rollar qo'shish:

```python
class UserRole(str, enum.Enum):
    admin = "admin"
    org_admin = "org_admin"   # YANGI
    teacher = "teacher"
    student = "student"
    parent = "parent"         # YANGI
```

`User` modeliga `org_id` FK qo'shish:

```python
# User class ichida:
org_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("organizations.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
)

phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

# Relationships qo'shish:
organization: Mapped["Organization | None"] = relationship(   # type: ignore
    "Organization", foreign_keys=[org_id], lazy="select"
)
parent_links: Mapped[list["ParentStudent"]] = relationship(   # type: ignore
    "ParentStudent", foreign_keys="ParentStudent.parent_id", lazy="select"
)
child_links: Mapped[list["ParentStudent"]] = relationship(    # type: ignore
    "ParentStudent", foreign_keys="ParentStudent.student_id", lazy="select"
)
```

---

## 1.2 — Yangi modellar: Organization

**Fayl:** `backend/db/models/organization.py`

```python
import enum
import uuid
from sqlalchemy import UUID, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class OrgType(str, enum.Enum):
    school = "school"           # Maktab
    learning_center = "learning_center"  # O'quv markaz
    university = "university"   # Oliy o'quv yurti


class OrgPlan(str, enum.Enum):
    free_trial = "free_trial"   # 30 kun bepul
    starter = "starter"         # ≤5 sinf, $50/oy
    growth = "growth"           # 6-15 sinf, $100/oy
    scale = "scale"             # 15+ sinf, $200/oy


class OrgStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    trial = "trial"


class Organization(Base, TimestampMixin):
    """Tashkilot (maktab yoki o'quv markaz)."""
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[OrgType] = mapped_column(
        Enum(OrgType, name="org_type"), nullable=False
    )
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    stir: Mapped[str | None] = mapped_column(String(20), nullable=True)  # INN
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan: Mapped[OrgPlan] = mapped_column(
        Enum(OrgPlan, name="org_plan"), default=OrgPlan.free_trial, nullable=False
    )
    status: Mapped[OrgStatus] = mapped_column(
        Enum(OrgStatus, name="org_status"), default=OrgStatus.trial, nullable=False
    )
    # Oylik AI token limiti (None = cheksiz)
    ai_token_limit: Mapped[int | None] = mapped_column(nullable=True)
    ai_tokens_used: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    owner: Mapped["User"] = relationship(    # type: ignore
        "User", foreign_keys=[owner_id], lazy="select"
    )
    members: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="organization", lazy="select"
    )
    requests: Mapped[list["OrganizationRequest"]] = relationship(
        "OrganizationRequest", back_populates="organization_ref", lazy="select"
    )


class OrganizationRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class OrganizationRequest(Base, TimestampMixin):
    """Tashkilot yaratish so'rovi — admin tomonidan ko'rib chiqiladi."""
    __tablename__ = "organization_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # So'rovdagi tashkilot ma'lumotlari JSON formatida
    org_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[OrganizationRequestStatus] = mapped_column(
        Enum(OrganizationRequestStatus, name="org_request_status"),
        default=OrganizationRequestStatus.pending, nullable=False
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Tasdiqlangach yaratilgan tashkilot ID
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True
    )

    requester: Mapped["User"] = relationship(   # type: ignore
        "User", foreign_keys=[user_id], lazy="select"
    )
    reviewer: Mapped["User | None"] = relationship(  # type: ignore
        "User", foreign_keys=[reviewed_by], lazy="select"
    )
    organization_ref: Mapped["Organization | None"] = relationship(
        "Organization", back_populates="requests", lazy="select"
    )


class OrgMemberRole(str, enum.Enum):
    org_admin = "org_admin"
    teacher = "teacher"
    student = "student"
    parent = "parent"


class OrganizationMember(Base, TimestampMixin):
    """Tashkilot a'zosi (User ↔ Organization ko'p-to-ko'p)."""
    __tablename__ = "organization_members"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role_in_org: Mapped[OrgMemberRole] = mapped_column(
        Enum(OrgMemberRole, name="org_member_role"), nullable=False
    )

    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="members", lazy="select"
    )
    user: Mapped["User"] = relationship("User", lazy="select")  # type: ignore
```

---

## 1.3 — Yangi model: Subject

**Fayl:** `backend/db/models/subject.py`

```python
import uuid
from sqlalchemy import UUID, ForeignKey, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class Subject(Base, TimestampMixin):
    """Fan/soha.

    org_id=None  → global fan (admin tomonidan yaratilgan, barchaga ko'rinadi)
    org_id=UUID  → tashkilot ichki fani (faqat o'sha org ko'radi)
    """
    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)  # emoji yoki icon nomi

    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True, index=True
    )

    organization: Mapped["Organization | None"] = relationship(   # type: ignore
        "Organization", lazy="select"
    )
```

---

## 1.4 — Yangi model: ParentStudent

**Fayl:** `backend/db/models/parent_student.py`

```python
import uuid
from sqlalchemy import UUID, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class ParentStudent(Base, TimestampMixin):
    """Ota-ona ↔ O'quvchi bog'lanishi.

    Xavfsizlik: org_admin tomonidan tasdiqlangandan keyin faol bo'ladi.
    """
    __tablename__ = "parent_students"

    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )
    is_confirmed: Mapped[bool] = mapped_column(default=False, nullable=False)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    parent: Mapped["User"] = relationship(   # type: ignore
        "User", foreign_keys=[parent_id], lazy="select"
    )
    student: Mapped["User"] = relationship(  # type: ignore
        "User", foreign_keys=[student_id], lazy="select"
    )
```

---

## 1.5 — Yangi model: Badge

**Fayl:** `backend/db/models/badge.py`

```python
import uuid
from sqlalchemy import UUID, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class Badge(Base, TimestampMixin):
    """Nishon (badge) ta'rifi."""
    __tablename__ = "badges"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    icon: Mapped[str] = mapped_column(String(100), nullable=False)  # emoji
    # Shart: {"type": "streak", "days": 7} yoki {"type": "mvp"} yoki {"type": "level", "level": 5}
    condition: Mapped[dict] = mapped_column(JSON, nullable=False)

    student_badges: Mapped[list["StudentBadge"]] = relationship(
        "StudentBadge", back_populates="badge", lazy="select"
    )


class StudentBadge(Base, TimestampMixin):
    """O'quvchi ↔ Nishon ko'p-to-ko'p."""
    __tablename__ = "student_badges"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"),
        nullable=False
    )

    badge: Mapped["Badge"] = relationship("Badge", back_populates="student_badges")
    student: Mapped["User"] = relationship("User", lazy="select")  # type: ignore
```

---

## 1.6 — Mavjud modellarni yangilash

### `course.py` — `org_id` qo'shish

```python
# Course class ichiga qo'shish:
org_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("organizations.id", ondelete="SET NULL"),
    nullable=True, index=True
)
subject_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("subjects.id", ondelete="SET NULL"),
    nullable=True
)
```

### `class_.py` — `org_id` va `subject_id` qo'shish

```python
# Class class ichiga qo'shish:
org_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("organizations.id", ondelete="SET NULL"),
    nullable=True, index=True
)
subject_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("subjects.id", ondelete="SET NULL"),
    nullable=True
)
grade_level: Mapped[int | None] = mapped_column(nullable=True)  # 1-11 sinf
```

---

## 1.7 — Topic modeli

**Fayl:** `backend/db/models/topic.py`

TZ v3 da kontent zanjiri: `Course → Module → Topic → Assignment`

```python
import uuid
from sqlalchemy import UUID, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class Topic(Base, TimestampMixin):
    """Mavzu — modul ichidagi kontent birligi.

    Zanjir: CourseModule → Topic → Assignment
    """
    __tablename__ = "topics"

    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_modules.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Kontent formatlari
    content_md: Mapped[str | None] = mapped_column(Text, nullable=True)        # Markdown
    content_latex: Mapped[str | None] = mapped_column(Text, nullable=True)     # LaTeX
    video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)  # YouTube/Vimeo

    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    module: Mapped["CourseModule"] = relationship(   # type: ignore
        "CourseModule", lazy="select"
    )
    assignments: Mapped[list["Assignment"]] = relationship(   # type: ignore
        "Assignment", back_populates="topic", lazy="select"
    )
```

`assignment.py` ga `topic_id` FK qo'shish:
```python
# Assignment modeliga:
topic_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("topics.id", ondelete="SET NULL"),
    nullable=True, index=True
)
topic: Mapped["Topic | None"] = relationship("Topic", back_populates="assignments")  # type: ignore
```

---

## 1.8 — `__init__.py` yangilash

`backend/db/models/__init__.py`:

```python
from backend.db.models.user import User, UserRole
from backend.db.models.organization import (
    Organization, OrganizationRequest, OrganizationMember,
    OrgType, OrgPlan, OrgStatus, OrgMemberRole
)
from backend.db.models.subject import Subject
from backend.db.models.parent_student import ParentStudent
from backend.db.models.badge import Badge, StudentBadge
from backend.db.models.course import Course, CourseModule, CourseEnrollment
from backend.db.models.class_ import Class, ClassEnrollment
from backend.db.models.topic import Topic
from backend.db.models.assignment import Assignment, Question
from backend.db.models.submission import Submission, SubmissionResult, Achievement
from backend.db.models.live_session import (
    LiveSession, LiveSessionTeam, LiveSessionParticipant, LiveSessionQuestion
)
from backend.db.models.refresh_session import RefreshSession
```

---

## 1.9 — Live Session modeli

**Fayl:** `backend/db/models/live_session.py`

```python
import enum
import uuid
from sqlalchemy import UUID, Enum, ForeignKey, JSON, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class GameType(str, enum.Enum):
    lucky_card = "lucky_card"       # Omad Sinovi
    blitz = "blitz"                 # Blitz Jang
    relay = "relay"                 # Zanjir Savol
    question_duel = "question_duel" # Kim So'raydi?
    territory = "territory"         # Xarita Jang
    pyramid = "pyramid"             # Piramida
    puzzle = "puzzle"               # Topishmoq Qatori


class SessionStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    finished = "finished"


class LiveSession(Base, TimestampMixin):
    """Interaktiv dars sessiyasi."""
    __tablename__ = "live_sessions"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    game_type: Mapped[GameType] = mapped_column(
        Enum(GameType, name="game_type"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status"),
        default=SessionStatus.pending, nullable=False
    )
    # O'yin sozlamalari JSON: {"team_count": 3, "question_count": 10, ...}
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # Barcha savollar JSON array
    questions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    current_question_index: Mapped[int] = mapped_column(default=0, nullable=False)

    teams: Mapped[list["LiveSessionTeam"]] = relationship(
        "LiveSessionTeam", back_populates="session", lazy="select"
    )
    participants: Mapped[list["LiveSessionParticipant"]] = relationship(
        "LiveSessionParticipant", back_populates="session", lazy="select"
    )


class LiveSessionTeam(Base, TimestampMixin):
    __tablename__ = "live_session_teams"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)  # hex: #FF5733
    score: Mapped[int] = mapped_column(default=0, nullable=False)

    session: Mapped["LiveSession"] = relationship(
        "LiveSession", back_populates="teams"
    )
    members: Mapped[list["LiveSessionParticipant"]] = relationship(
        "LiveSessionParticipant", back_populates="team", lazy="select"
    )


class LiveSessionParticipant(Base, TimestampMixin):
    __tablename__ = "live_session_participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_session_teams.id", ondelete="SET NULL"),
        nullable=True
    )
    personal_score: Mapped[int] = mapped_column(default=0, nullable=False)
    answers: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_mvp: Mapped[bool] = mapped_column(default=False, nullable=False)

    session: Mapped["LiveSession"] = relationship(
        "LiveSession", back_populates="participants"
    )
    team: Mapped["LiveSessionTeam | None"] = relationship(
        "LiveSessionTeam", back_populates="members"
    )
    student: Mapped["User"] = relationship("User", lazy="select")  # type: ignore
```

---

## 1.10 — Auth Endpoints yangilash

**Fayl:** `backend/api/deps.py`

```python
from backend.db.models.user import UserRole

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin roli kerak")
    return current_user

async def require_org_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.org_admin):
        raise HTTPException(status_code=403, detail="Org-admin roli kerak")
    return current_user

async def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.org_admin, UserRole.teacher):
        raise HTTPException(status_code=403, detail="O'qituvchi roli kerak")
    return current_user

async def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="O'quvchi roli kerak")
    return current_user

async def get_user_org(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> uuid.UUID | None:
    """Foydalanuvchining tashkilot ID sini qaytaradi."""
    return current_user.org_id
```

---

## 1.11 — Alembic Migration

```bash
# Barcha yangi modellar import qilingandan keyin:
alembic revision --autogenerate -m "tz_v3_add_org_topic_live_badge"
alembic upgrade head
```

**Tekshirish:**
```bash
# Barcha jadvallar mavjudligini tekshirish:
psql $DATABASE_URL -c "\dt" | grep -E "organizations|subjects|topics|live_sessions|badges|parent_students"
```

---

## Muvaffaqiyat mezoni

- [ ] `alembic upgrade head` xatosiz ishlaydi
- [ ] DB da yangi jadvallar ko'rinadi: `organizations`, `organization_requests`, `organization_members`, `subjects`, `topics`, `live_sessions`, `live_session_teams`, `live_session_participants`, `badges`, `student_badges`, `parent_students`
- [ ] `UserRole` enum da `org_admin` va `parent` mavjud
- [ ] `GET /health` ishlaydi
- [ ] `POST /api/v1/auth/register` → token qaytaradi
