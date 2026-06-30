from datetime import datetime

from pydantic import BaseModel, Field


class LicenseTypeResponse(BaseModel):
    id: int
    code: str
    name: str
    name_en: str | None = None
    description: str | None
    description_en: str | None = None
    fee_amount: float
    physical_surcharge: float
    validity_months: int
    required_documents: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class LicenseTypeCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=255)
    name_en: str | None = Field(None, max_length=255)
    description: str | None = None
    description_en: str | None = None
    fee_amount: float = Field(ge=0)
    physical_surcharge: float = Field(ge=0, default=0)
    validity_months: int = Field(ge=1, default=12)
    required_documents: str | None = None
    is_active: bool = True


class LicenseTypeUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    name_en: str | None = Field(None, max_length=255)
    description: str | None = None
    description_en: str | None = None
    fee_amount: float | None = Field(None, ge=0)
    physical_surcharge: float | None = Field(None, ge=0)
    validity_months: int | None = Field(None, ge=1)
    required_documents: str | None = None
    is_active: bool | None = None
