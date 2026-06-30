from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import Application, ApplicationStatus
from app.models.license_type import LicenseType
from app.models.payment_transaction import PaymentStatus, PaymentTransaction
from app.schemas.revenue import (
    RevenueByLicenseType,
    RevenueByMonth,
    RevenueEntryResponse,
    RevenueSummaryResponse,
)

CONFIRMED_STATUSES = (ApplicationStatus.PAID, ApplicationStatus.DELIVERED)


def revenue_state_for(application: Application) -> str:
    if application.status in CONFIRMED_STATUSES and application.amount_paid is not None:
        return "confirmed"
    if application.status == ApplicationStatus.AWAITING_PAYMENT and application.amount_paid is not None:
        return "pending_validation"
    return "other"


async def fetch_revenue_summary(db: AsyncSession) -> RevenueSummaryResponse:
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_confirmed = float(
        await db.scalar(
            select(func.coalesce(func.sum(Application.amount_paid), 0)).where(
                Application.status.in_(CONFIRMED_STATUSES),
                Application.amount_paid.is_not(None),
            )
        )
        or 0
    )
    confirmed_this_month = float(
        await db.scalar(
            select(func.coalesce(func.sum(Application.amount_paid), 0)).where(
                Application.status.in_(CONFIRMED_STATUSES),
                Application.amount_paid.is_not(None),
                Application.paid_at.is_not(None),
                Application.paid_at >= month_start,
            )
        )
        or 0
    )
    pending_validation_amount = float(
        await db.scalar(
            select(func.coalesce(func.sum(Application.amount_paid), 0)).where(
                Application.status == ApplicationStatus.AWAITING_PAYMENT,
                Application.amount_paid.is_not(None),
            )
        )
        or 0
    )
    pending_validation_count = int(
        await db.scalar(
            select(func.count()).select_from(Application).where(
                Application.status == ApplicationStatus.AWAITING_PAYMENT,
                Application.amount_paid.is_not(None),
            )
        )
        or 0
    )
    awaiting_payment_count = int(
        await db.scalar(
            select(func.count()).select_from(Application).where(
                Application.status == ApplicationStatus.AWAITING_PAYMENT,
                Application.amount_paid.is_(None),
            )
        )
        or 0
    )
    confirmed_count = int(
        await db.scalar(
            select(func.count()).select_from(Application).where(
                Application.status.in_(CONFIRMED_STATUSES),
                Application.amount_paid.is_not(None),
            )
        )
        or 0
    )

    type_rows = await db.execute(
        select(
            LicenseType.name,
            func.count(Application.id),
            func.coalesce(func.sum(Application.amount_paid), 0),
        )
        .join(Application, Application.license_type_id == LicenseType.id)
        .where(
            Application.status.in_(CONFIRMED_STATUSES),
            Application.amount_paid.is_not(None),
        )
        .group_by(LicenseType.name)
        .order_by(func.sum(Application.amount_paid).desc())
    )
    by_license_type = [
        RevenueByLicenseType(
            license_type_name=name,
            count=int(count),
            total_amount=float(total),
        )
        for name, count, total in type_rows.all()
    ]

    month_bucket = func.date_trunc("month", Application.paid_at)
    month_rows = await db.execute(
        select(
            func.to_char(month_bucket, "YYYY-MM"),
            func.count(Application.id),
            func.coalesce(func.sum(Application.amount_paid), 0),
        )
        .where(
            Application.status.in_(CONFIRMED_STATUSES),
            Application.amount_paid.is_not(None),
            Application.paid_at.is_not(None),
        )
        .group_by(month_bucket)
        .order_by(month_bucket.desc())
        .limit(12)
    )
    by_month = [
        RevenueByMonth(month=month, count=int(count), total_amount=float(total))
        for month, count, total in month_rows.all()
    ]

    return RevenueSummaryResponse(
        total_confirmed=total_confirmed,
        confirmed_this_month=confirmed_this_month,
        pending_validation_amount=pending_validation_amount,
        pending_validation_count=pending_validation_count,
        awaiting_payment_count=awaiting_payment_count,
        confirmed_count=confirmed_count,
        by_license_type=by_license_type,
        by_month=by_month,
    )


async def fetch_revenue_entries(
    db: AsyncSession,
    *,
    state: str | None = None,
) -> list[RevenueEntryResponse]:
    query = (
        select(Application)
        .where(Application.amount_paid.is_not(None))
        .order_by(Application.paid_at.desc().nullslast(), Application.updated_at.desc())
    )
    if state == "confirmed":
        query = query.where(Application.status.in_(CONFIRMED_STATUSES))
    elif state == "pending_validation":
        query = query.where(
            Application.status == ApplicationStatus.AWAITING_PAYMENT,
            Application.amount_paid.is_not(None),
        )

    query = query.options(
        selectinload(Application.license_type),
        selectinload(Application.applicant),
        selectinload(Application.payment_transactions),
    )

    result = await db.execute(query)
    applications = result.scalars().all()

    entries: list[RevenueEntryResponse] = []
    for app in applications:
        payment_ref = None
        completed = [tx for tx in app.payment_transactions if tx.status == PaymentStatus.COMPLETED]
        if completed:
            latest = max(completed, key=lambda tx: tx.created_at)
            payment_ref = latest.bamboo_ref or latest.billing_id

        entries.append(
            RevenueEntryResponse(
                application_id=app.id,
                reference=app.reference,
                applicant_name=app.applicant.full_name if app.applicant else "—",
                license_type_name=app.license_type.name if app.license_type else "—",
                amount=float(app.amount_paid),
                delivery_format=app.delivery_format.value if app.delivery_format else None,
                status=app.status,
                paid_at=app.paid_at,
                payment_reference=payment_ref,
                revenue_state=revenue_state_for(app),
            )
        )
    return entries
