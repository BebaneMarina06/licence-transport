import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    billing_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    bamboo_ref: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    phone: Mapped[str] = mapped_column(String(20))
    operator: Mapped[str | None] = mapped_column(String(30), nullable=True)
    delivery_format: Mapped[str] = mapped_column(String(20))
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    application = relationship("Application", back_populates="payment_transactions")
