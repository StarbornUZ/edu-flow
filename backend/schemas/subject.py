import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SubjectCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    is_default: bool = False
    org_id: uuid.UUID | None = None


class SubjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    is_default: bool | None = None


class SubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    icon: str | None
    is_default: bool
    org_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
