import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.document import ApplicationDocument
    from app.models.issued_license import IssuedLicense
    from app.models.license_type import LicenseType
    from app.models.payment_transaction import PaymentTransaction
    from app.models.user import User


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    COMPLEMENT_REQUESTED = "complement_requested"
    APPROVED = "approved"
    AWAITING_PAYMENT = "awaiting_payment"
    PAID = "paid"
    DELIVERED = "delivered"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DeliveryFormat(str, enum.Enum):
    DIGITAL = "digital"
    PHYSICAL = "physical"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    license_type_id: Mapped[int] = mapped_column(ForeignKey("license_types.id"))
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.DRAFT
    )
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_format: Mapped[DeliveryFormat | None] = mapped_column(Enum(DeliveryFormat), nullable=True)
    amount_paid: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_agent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    applicant: Mapped["User"] = relationship(back_populates="applications", foreign_keys=[applicant_id])
    license_type: Mapped["LicenseType"] = relationship(back_populates="applications")
    status_history: Mapped[list["ApplicationStatusHistory"]] = relationship(
        back_populates="application", order_by="ApplicationStatusHistory.created_at"
    )
    documents: Mapped[list["ApplicationDocument"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    issued_license: Mapped["IssuedLicense | None"] = relationship(
        back_populates="application", uselist=False
    )
    assigned_agent: Mapped["User | None"] = relationship(
        foreign_keys=[assigned_agent_id],
    )
    payment_transactions: Mapped[list["PaymentTransaction"]] = relationship(
        back_populates="application",
        order_by="PaymentTransaction.created_at.desc()",
    )


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    from_status: Mapped[ApplicationStatus | None] = mapped_column(Enum(ApplicationStatus), nullable=True)
    to_status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped["Application"] = relationship(back_populates="status_history")
    changed_by: Mapped["User | None"] = relationship(foreign_keys=[changed_by_id])
