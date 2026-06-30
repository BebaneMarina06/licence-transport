from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.application import Application


class IssuedLicense(Base):
    __tablename__ = "issued_licenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True)
    license_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    verification_sig: Mapped[str] = mapped_column(String(64))
    holder_name: Mapped[str] = mapped_column(String(255))
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    license_type_name: Mapped[str] = mapped_column(String(255))
    pdf_filename: Mapped[str] = mapped_column(String(255))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    application: Mapped["Application"] = relationship(back_populates="issued_license")
