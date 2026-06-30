import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.application import Application


class DocumentType(str, enum.Enum):
    CARTE_GRISE = "carte_grise"
    VISITE_TECHNIQUE = "visite_technique"
    ASSURANCE = "assurance"


DOCUMENT_LABELS = {
    DocumentType.CARTE_GRISE: "Photocopie carte grise",
    DocumentType.VISITE_TECHNIQUE: "Photocopie visite technique",
    DocumentType.ASSURANCE: "Photocopie assurance",
}

REQUIRED_DOCUMENT_TYPES = list(DocumentType)


class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType))
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    application: Mapped["Application"] = relationship(back_populates="documents")
