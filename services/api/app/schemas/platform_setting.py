from pydantic import BaseModel, Field


class OcrSettingsResponse(BaseModel):
    enabled: bool


class OcrSettingsUpdate(BaseModel):
    enabled: bool
