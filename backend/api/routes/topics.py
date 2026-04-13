"""Mavzular (Topics) endpointlari — CourseModule ichida."""
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.api.deps import CurrentTeacher, CurrentUser, DBSession
from backend.db.models.topic import Topic
from backend.db.models.user import UserRole
from backend.repositories.course_repo import CourseRepository
from backend.schemas.topic import TopicCreate, TopicResponse, TopicUpdate

router = APIRouter()


async def _get_module_or_404(db: DBSession, module_id: uuid.UUID):
    repo = CourseRepository(db)
    module = await repo.get_module(module_id)
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Modul topilmadi")
    return module


async def _get_topic_or_404(db: DBSession, topic_id: uuid.UUID) -> Topic:
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mavzu topilmadi")
    return topic


# ---------------------------------------------------------------------------
# GET /modules/{module_id}/topics
# ---------------------------------------------------------------------------

@router.get(
    "/{module_id}/topics",
    response_model=list[TopicResponse],
    summary="Modul mavzulari ro'yxati",
)
async def list_topics(module_id: uuid.UUID, user: CurrentUser, db: DBSession):
    await _get_module_or_404(db, module_id)
    result = await db.execute(
        select(Topic)
        .where(Topic.module_id == module_id)
        .order_by(Topic.order_index)
    )
    topics = result.scalars().all()
    return [TopicResponse.model_validate(t) for t in topics]


# ---------------------------------------------------------------------------
# POST /modules/{module_id}/topics
# ---------------------------------------------------------------------------

@router.post(
    "/{module_id}/topics",
    response_model=TopicResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Modulga mavzu qo'shish (teacher)",
)
async def create_topic(
    module_id: uuid.UUID,
    data: TopicCreate,
    teacher: CurrentTeacher,
    db: DBSession,
):
    module = await _get_module_or_404(db, module_id)

    # Teacher faqat o'z kursi moduliga mavzu qo'sha oladi
    repo = CourseRepository(db)
    course = await repo.get_by_id(module.course_id)
    if course and course.teacher_id != teacher.id and teacher.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu modul sizga tegishli emas")

    from sqlalchemy import func
    idx_result = await db.execute(
        select(func.max(Topic.order_index)).where(Topic.module_id == module_id)
    )
    next_index = (idx_result.scalar_one_or_none() or -1) + 1

    topic = Topic(
        module_id=module_id,
        title=data.title,
        order_index=next_index,
        content_md=data.content_md,
        content_latex=data.content_latex,
        video_url=data.video_url,
        is_published=data.is_published,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return TopicResponse.model_validate(topic)


# ---------------------------------------------------------------------------
# GET /modules/{module_id}/topics/{topic_id}
# ---------------------------------------------------------------------------

@router.get(
    "/{module_id}/topics/{topic_id}",
    response_model=TopicResponse,
    summary="Mavzu ma'lumotlari",
)
async def get_topic(
    module_id: uuid.UUID,
    topic_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
):
    topic = await _get_topic_or_404(db, topic_id)
    if topic.module_id != module_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mavzu bu modulga tegishli emas")
    return TopicResponse.model_validate(topic)


# ---------------------------------------------------------------------------
# PATCH /modules/{module_id}/topics/{topic_id}
# ---------------------------------------------------------------------------

@router.patch(
    "/{module_id}/topics/{topic_id}",
    response_model=TopicResponse,
    summary="Mavzuni yangilash (teacher)",
)
async def update_topic(
    module_id: uuid.UUID,
    topic_id: uuid.UUID,
    data: TopicUpdate,
    teacher: CurrentTeacher,
    db: DBSession,
):
    topic = await _get_topic_or_404(db, topic_id)
    if topic.module_id != module_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mavzu bu modulga tegishli emas")

    updates = data.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(topic, key, value)
    await db.commit()
    await db.refresh(topic)
    return TopicResponse.model_validate(topic)


# ---------------------------------------------------------------------------
# DELETE /modules/{module_id}/topics/{topic_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/{module_id}/topics/{topic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mavzuni o'chirish (teacher)",
)
async def delete_topic(
    module_id: uuid.UUID,
    topic_id: uuid.UUID,
    teacher: CurrentTeacher,
    db: DBSession,
):
    topic = await _get_topic_or_404(db, topic_id)
    if topic.module_id != module_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mavzu bu modulga tegishli emas")
    await db.delete(topic)
    await db.commit()
