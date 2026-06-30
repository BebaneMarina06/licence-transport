from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.document import DocumentType


class DocumentResponse(BaseModel):
    id: int
    document_type: DocumentType
    original_filename: str
    content_type: str
    file_size: int
    uploaded_at: datetime
    ocr_fields: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    document: DocumentResponse
    ocr_enabled: bool = False
    ocr_applied: list[str] = Field(default_factory=list)
    ocr_fields: dict[str, Any] = Field(default_factory=dict)
    ocr_message: str | None = None
