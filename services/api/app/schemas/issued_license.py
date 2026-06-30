from datetime import datetime

from pydantic import BaseModel


class IssuedLicenseResponse(BaseModel):
    id: int
    license_number: str
    holder_name: str
    company_name: str | None
    vehicle_plate: str | None
    license_type_name: str
    issued_at: datetime
    expires_at: datetime
    is_revoked: bool

    model_config = {"from_attributes": True}


class LicenseVerificationResponse(BaseModel):
    valid: bool
    license_number: str
    holder_name: str | None = None
    company_name: str | None = None
    vehicle_plate: str | None = None
    license_type_name: str | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    status: str
    message: str
