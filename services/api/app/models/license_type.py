from datetime import datetime

from sqlalchemy import Boolean, DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LicenseType(Base):
    __tablename__ = "license_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    name_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    fee_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    physical_surcharge: Mapped[float] = mapped_column(Numeric(12, 2), default=50000)
    validity_months: Mapped[int] = mapped_column(default=12)
    required_documents: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    applications: Mapped[list["Application"]] = relationship(back_populates="license_type")
