from datetime import datetime

from pydantic import BaseModel

from app.models.application import ApplicationStatus


class RevenueByLicenseType(BaseModel):
    license_type_name: str
    count: int
    total_amount: float


class RevenueByMonth(BaseModel):
    month: str
    count: int
    total_amount: float


class RevenueSummaryResponse(BaseModel):
    total_confirmed: float
    confirmed_this_month: float
    pending_validation_amount: float
    pending_validation_count: int
    awaiting_payment_count: int
    confirmed_count: int
    by_license_type: list[RevenueByLicenseType]
    by_month: list[RevenueByMonth]


class RevenueEntryResponse(BaseModel):
    application_id: int
    reference: str
    applicant_name: str
    license_type_name: str
    amount: float
    delivery_format: str | None
    status: ApplicationStatus
    paid_at: datetime | None
    payment_reference: str | None
    revenue_state: str
