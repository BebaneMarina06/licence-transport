from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class StaffUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StaffUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    role: UserRole = UserRole.AGENT


class StaffUserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class CitizenListResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    national_id: str | None
    is_active: bool
    created_at: datetime
    applications_count: int = 0

    model_config = {"from_attributes": True}


class AssignAgentUpdate(BaseModel):
    assigned_agent_id: int | None = None
