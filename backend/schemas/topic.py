import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TopicCreate(BaseModel):
    title: str
    order_index: int = 0
    content_md: str | None = None
    content_latex: str | None = None
    video_url: str | None = None
    is_published: bool = False


class TopicUpdate(BaseModel):
    title: str | None = None
    order_index: int | None = None
    content_md: str | None = None
    content_latex: str | None = None
    video_url: str | None = None
    is_published: bool | None = None


class TopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    order_index: int
    content_md: str | None
    content_latex: str | None
    video_url: str | None
    is_published: bool
    created_at: datetime
    updated_at: datetime
