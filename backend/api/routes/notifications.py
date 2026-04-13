"""Bildirishnoma endpointlari."""
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy import update as sql_update

from backend.api.deps import CurrentUser, DBSession
from backend.db.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    data: dict
    is_read: bool
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(user: CurrentUser, db: DBSession):
    """Foydalanuvchining bildirishnomalari (o'qilmagan avval)."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    return [
        NotificationResponse(
            id=n.id,
            type=n.type,
            title=n.title,
            body=n.body,
            data=n.data or {},
            is_read=n.is_read,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]


@router.post("/{notification_id}/read")
async def mark_read(notification_id: uuid.UUID, user: CurrentUser, db: DBSession):
    """Bildirishnomani o'qilgan deb belgilash."""
    notif = await db.get(Notification, notification_id)
    if not notif:
        raise HTTPException(404, "Bildirishnoma topilmadi")
    if notif.user_id != user.id:
        raise HTTPException(403, "Ruxsat yo'q")
    await db.execute(
        sql_update(Notification)
        .where(Notification.id == notification_id)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user: CurrentUser, db: DBSession):
    """Barcha bildirishnomalarni o'qilgan deb belgilash."""
    await db.execute(
        sql_update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}
