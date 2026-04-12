# Faza 3 — Academic Core: Class · Course · Topic · Assignment
> **Mas'ul:** Muxtorov Javohirbek
> **Vaqt:** Kun 1 · 13:00–17:00 (~4 soat)
> **Kerak:** Faza 1 + Faza 2 tugagan bo'lishi shart
> **Bloklovchi:** Faza 4 (AI) va Faza 6 (Frontend)

---

## Kontekst

Bu faza o'qituvchining asosiy ish oqimini yopadi:
- **Class** — sinflar + o'quvchi biriktirish (mavjud, faqat `org_id` qo'shiladi)
- **Course** — kurs CRUD + sinfga biriktirish (mavjud, `org_id` qo'shiladi)
- **Module** — kurs modullari (mavjud `CourseModule`)
- **Topic** — yangi! Modul ichidagi mavzu (Markdown + LaTeX + video)
- **Assignment** — mavzuga biriktirilgan vazifa (mavjud, `topic_id` qo'shiladi)

Kontent zanjiri: `Course → Module → Topic → Assignment → Submission`

---

## 3.1 — Class endpoints yangilash

**Mavjud:** `backend/api/routes/classes.py`

Faqat `org_id` filter qo'shish kerak — teacher faqat o'z org sinflarini ko'rsin:

```python
# GET /classes ga filter:
@router.get("/")
async def list_classes(
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from backend.db.models.class_ import Class

    q = select(Class).where(Class.teacher_id == current_user.id)
    # Agar org_admin — barcha org sinflarini ko'rsatish
    if current_user.role in ("admin", "org_admin"):
        q = select(Class).where(Class.org_id == current_user.org_id)

    result = await db.execute(q.order_by(Class.created_at.desc()))
    return result.scalars().all()


# POST /classes ga org_id qo'shish:
@router.post("/", status_code=201)
async def create_class(
    body: ClassCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from backend.db.models.class_ import Class
    import secrets, string
    from datetime import datetime, timedelta, timezone

    code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    class_ = Class(
        teacher_id=current_user.id,
        org_id=current_user.org_id,          # ← YANGI
        name=body.name,
        subject=body.subject,
        academic_year=body.academic_year,
        class_code=code,
        class_code_expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(class_)
    await db.commit()
    await db.refresh(class_)
    return class_
```

---

## 3.2 — Course endpoints yangilash

**Mavjud:** `backend/api/routes/courses.py`

`org_id` qo'shish:

```python
@router.post("/", status_code=201)
async def create_course(
    body: CourseCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from backend.db.models.course import Course
    course = Course(
        teacher_id=current_user.id,
        org_id=current_user.org_id,      # ← YANGI
        subject_id=body.subject_id,      # ← YANGI (ixtiyoriy)
        title=body.title,
        description=body.description,
        subject=body.subject,
        difficulty=body.difficulty,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course
```

**Kursga sinf biriktirish (Many-to-Many):**
```python
@router.post("/{course_id}/classes/{class_id}")
async def attach_class_to_course(
    course_id: uuid.UUID,
    class_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from backend.db.models.course import CourseEnrollment
    enrollment = CourseEnrollment(
        course_id=course_id,
        class_id=class_id,
        enrolled_by=current_user.id,
    )
    db.add(enrollment)
    await db.commit()
    return {"status": "attached"}


@router.delete("/{course_id}/classes/{class_id}")
async def detach_class_from_course(
    course_id: uuid.UUID,
    class_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete as sql_delete
    from backend.db.models.course import CourseEnrollment
    await db.execute(
        sql_delete(CourseEnrollment).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.class_id == class_id,
        )
    )
    await db.commit()
    return {"status": "detached"}
```

---

## 3.3 — Module endpoints

Mavjud `CourseModule` ga yangi endpoint — `topics` CRUD uchun relationship tayyorlash:

```python
# GET /courses/{id}/modules — mavjud endpoint (order_number bo'yicha saralangan)
# POST /courses/{id}/modules — yangi modul qo'shish

@router.post("/{course_id}/modules", status_code=201)
async def add_module(
    course_id: uuid.UUID,
    body: ModuleCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from backend.db.models.course import CourseModule
    from sqlalchemy import func, select

    # Oxirgi order_number ni topish
    last_order = await db.execute(
        select(func.max(CourseModule.order_number)).where(
            CourseModule.course_id == course_id
        )
    )
    next_order = (last_order.scalar() or 0) + 1

    module = CourseModule(
        course_id=course_id,
        title=body.title,
        content_md=body.content_md or "",
        order_number=next_order,
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return module
```

---

## 3.4 — Topic endpoints (YANGI)

**Fayl:** `backend/api/routes/topics.py`

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from backend.api.deps import get_db, get_current_user, require_teacher
from backend.db.models.user import User
from backend.db.models.topic import Topic

router = APIRouter(tags=["topics"])


class TopicCreate(BaseModel):
    title: str
    content_md: str | None = None
    content_latex: str | None = None
    video_url: str | None = None
    order_index: int = 0


class TopicUpdate(BaseModel):
    title: str | None = None
    content_md: str | None = None
    content_latex: str | None = None
    video_url: str | None = None
    is_published: bool | None = None


@router.post("/modules/{module_id}/topics", status_code=201)
async def create_topic(
    module_id: uuid.UUID,
    body: TopicCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Modul ichida yangi mavzu yaratish."""
    topic = Topic(
        module_id=module_id,
        title=body.title,
        content_md=body.content_md,
        content_latex=body.content_latex,
        video_url=body.video_url,
        order_index=body.order_index,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/modules/{module_id}/topics")
async def list_topics(
    module_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Modul mavzulari ro'yxati (o'quvchi ham ko'ra oladi)."""
    result = await db.execute(
        select(Topic)
        .where(Topic.module_id == module_id)
        .order_by(Topic.order_index)
    )
    return result.scalars().all()


@router.get("/topics/{topic_id}")
async def get_topic(
    topic_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mavzu kontentini o'qish (student + teacher)."""
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Mavzu topilmadi")
    return topic


@router.patch("/topics/{topic_id}")
async def update_topic(
    topic_id: uuid.UUID,
    body: TopicUpdate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Mavzuni tahrirlash."""
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(404, "Mavzu topilmadi")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(topic, field, value)

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/topics/{topic_id}", status_code=204)
async def delete_topic(
    topic_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    topic = await db.get(Topic, topic_id)
    if topic:
        await db.delete(topic)
        await db.commit()
```

---

## 3.5 — Assignment ga topic_id qo'shish

**Mavjud:** `backend/api/routes/assignments.py`

`assignment.py` schema va route da `topic_id` ni qo'llash:

```python
# AssignmentCreate sxemasiga:
class AssignmentCreate(BaseModel):
    topic_id: uuid.UUID | None = None  # ← YANGI (mavzu bilan bog'lash)
    course_id: uuid.UUID
    title: str
    instructions: str | None = None
    question_type: QuestionType
    time_limit_sec: int | None = None
    max_attempts: int = 3
    deadline: datetime | None = None

# POST /assignments da:
assignment = Assignment(
    topic_id=body.topic_id,   # ← YANGI
    course_id=body.course_id,
    teacher_id=current_user.id,
    ...
)
```

**Topic bo'yicha vazifalar:**
```python
# GET /topics/{topic_id}/assignments
@router.get("/topics/{topic_id}/assignments")
async def get_topic_assignments(
    topic_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.db.models.assignment import Assignment
    result = await db.execute(
        select(Assignment).where(Assignment.topic_id == topic_id)
    )
    return result.scalars().all()
```

---

## 3.6 — Student ko'rinishlari

O'quvchi o'ziga tegishli kurslarni ko'rishi uchun:

```python
# GET /courses/my — student uchun
@router.get("/my")
async def my_courses(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """O'quvchining o'z kurslari."""
    from backend.db.models.course import CourseEnrollment, Course
    from backend.db.models.class_ import ClassEnrollment

    # 1. O'quvchi qaysi sinflarda?
    class_result = await db.execute(
        select(ClassEnrollment.class_id).where(
            ClassEnrollment.student_id == current_user.id,
            ClassEnrollment.status == "active"
        )
    )
    class_ids = [r[0] for r in class_result.all()]

    # 2. O'sha sinflarga biriktirilgan kurslar
    if not class_ids:
        return []

    course_result = await db.execute(
        select(Course)
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .where(CourseEnrollment.class_id.in_(class_ids))
        .distinct()
    )
    return course_result.scalars().all()
```

---

## 3.7 — Subject endpoints

**Fayl:** `backend/api/routes/subjects.py`

```python
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from backend.api.deps import get_db, get_current_user, require_admin
from backend.db.models.user import User
from backend.db.models.subject import Subject

router = APIRouter(prefix="/subjects", tags=["subjects"])


class SubjectCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    is_default: bool = False


@router.get("/")
async def list_subjects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Global + tashkilot fanlarini qaytaradi."""
    result = await db.execute(
        select(Subject).where(
            or_(Subject.org_id == None, Subject.org_id == current_user.org_id)
        ).order_by(Subject.is_default.desc(), Subject.name)
    )
    return result.scalars().all()


@router.post("/", status_code=201)
async def create_subject(
    body: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: global fan yaratadi (org_id=None, is_default=True)
    Org-admin: tashkilot ichki fani yaratadi (org_id=current_user.org_id)
    """
    from backend.db.models.user import UserRole
    org_id = None if current_user.role == UserRole.admin else current_user.org_id

    subject = Subject(
        name=body.name,
        description=body.description,
        icon=body.icon,
        is_default=body.is_default and current_user.role == UserRole.admin,
        org_id=org_id,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject
```

---

## 3.8 — `main.py` ga routerlarni qo'shish

```python
from backend.api.routes import topics, subjects

app.include_router(topics.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
```

---

## Muvaffaqiyat mezoni

- [ ] `POST /api/v1/courses` `org_id` bilan saqlanadi
- [ ] `POST /api/v1/classes` `org_id` bilan saqlanadi
- [ ] `POST /api/v1/courses/{id}/classes/{class_id}` — kursga sinf biriktiriladi
- [ ] `POST /api/v1/modules/{id}/topics` — yangi mavzu yaratiladi
- [ ] `GET /api/v1/topics/{id}` — mavzu kontenti (Markdown, LaTeX, video URL) qaytaradi
- [ ] `GET /api/v1/courses/my` — student o'z kurslarini ko'radi
- [ ] `GET /api/v1/subjects` — global + org fanlar ro'yxati
- [ ] Assignments `topic_id` bilan saqlanadi
