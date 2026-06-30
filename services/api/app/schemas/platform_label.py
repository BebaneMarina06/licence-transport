from datetime import datetime

from pydantic import BaseModel, Field


class PlatformLabelResponse(BaseModel):
    id: int
    key: str
    category: str
    label_fr: str
    label_en: str
    description: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlatformLabelCreate(BaseModel):
    key: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9._-]+$")
    category: str = Field(default="portal", max_length=50)
    label_fr: str = Field(min_length=1, max_length=500)
    label_en: str = Field(min_length=1, max_length=500)
    description: str | None = None


class PlatformLabelUpdate(BaseModel):
    category: str | None = None
    label_fr: str | None = Field(None, min_length=1, max_length=500)
    label_en: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None


class LabelsDictionary(BaseModel):
    lang: str
    labels: dict[str, str]
