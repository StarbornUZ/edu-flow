import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Organization schemas
# ---------------------------------------------------------------------------

class OrganizationCreate(BaseModel):
    name: str
    type: str  # school | learning_center | university
    address: str | None = None
    phone: str | None = None
    stir: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    stir: str | None = None


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    address: str | None
    phone: str | None
    stir: str | None
    owner_id: uuid.UUID
    plan: str
    status: str
    ai_token_limit: int | None
    ai_tokens_used: int
    created_at: datetime
    updated_at: datetime


class OrganizationWithCountsResponse(OrganizationResponse):
    teachers_count: int = 0
    students_count: int = 0


# ---------------------------------------------------------------------------
# OrganizationRequest schemas
# ---------------------------------------------------------------------------

class OrgRequestCreate(BaseModel):
    org_data: dict  # {name, type, address, phone, stir, ...}


class OrgRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    org_data: dict
    status: str
    reviewed_by: uuid.UUID | None
    review_note: str | None
    organization_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class OrgRequestReview(BaseModel):
    approve: bool
    review_note: str | None = None


# ---------------------------------------------------------------------------
# OrganizationMember schemas
# ---------------------------------------------------------------------------

class OrgMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    role_in_org: str
    created_at: datetime
    updated_at: datetime


class OrgMemberAdd(BaseModel):
    user_id: uuid.UUID
    role_in_org: str  # org_admin | teacher | student | parent
