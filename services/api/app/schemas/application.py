from datetime import datetime

from pydantic import BaseModel

from app.models.application import ApplicationStatus, DeliveryFormat
from app.schemas.license_type import LicenseTypeResponse
from app.schemas.auth import UserResponse
from app.schemas.document import DocumentResponse
from app.schemas.issued_license import IssuedLicenseResponse


class ApplicationCreate(BaseModel):
    license_type_id: int
    company_name: str | None = None
    vehicle_plate: str | None = None
    notes: str | None = None


class ApplicationUpdate(BaseModel):
    company_name: str | None = None
    vehicle_plate: str | None = None
    notes: str | None = None


class StatusHistoryResponse(BaseModel):
    id: int
    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    comment: str | None
    changed_by_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationAssignUpdate(BaseModel):
    assigned_agent_id: int | None = None


class ApplicationResponse(BaseModel):
    id: int
    reference: str
    status: ApplicationStatus
    company_name: str | None
    vehicle_plate: str | None
    notes: str | None
    rejection_reason: str | None
    delivery_format: DeliveryFormat | None = None
    amount_paid: float | None = None
    paid_at: datetime | None = None
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    license_type: LicenseTypeResponse
    status_history: list[StatusHistoryResponse] = []
    documents: list[DocumentResponse] = []
    issued_license: IssuedLicenseResponse | None = None
    applicant: UserResponse | None = None
    assigned_agent: UserResponse | None = None

    model_config = {"from_attributes": True}


class ApplicationListResponse(BaseModel):
    id: int
    reference: str
    status: ApplicationStatus
    company_name: str | None
    vehicle_plate: str | None
    delivery_format: DeliveryFormat | None = None
    amount_paid: float | None = None
    paid_at: datetime | None = None
    submitted_at: datetime | None
    created_at: datetime
    license_type: LicenseTypeResponse
    issued_license: IssuedLicenseResponse | None = None
    applicant: UserResponse | None = None
    assigned_agent: UserResponse | None = None

    model_config = {"from_attributes": True}


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    comment: str | None = None
    rejection_reason: str | None = None
