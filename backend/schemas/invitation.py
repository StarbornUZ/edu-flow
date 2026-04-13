"""OrgInvitation sxemalari."""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class OrgInvitationCreate(BaseModel):
    user_id: uuid.UUID
    role_in_org: str  # teacher | student | parent
    message: str | None = None


class OrgInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    org_name: str
    invited_user_id: uuid.UUID
    invited_user_name: str
    invited_user_email: str
    invited_by: uuid.UUID | None
    role_in_org: str
    status: str
    message: str | None
    created_at: datetime
