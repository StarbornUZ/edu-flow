"""Ota-ona (Parent) sxemalari."""
import uuid
from pydantic import BaseModel, ConfigDict


class ParentAssignRequest(BaseModel):
    email: str
    full_name: str | None = None  # yangi ota-ona yaratishda talab qilinadi


class ParentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    username: str | None
    phone: str | None
    is_confirmed: bool
    generated_password: str | None = None  # faqat yangi yaratilganda
