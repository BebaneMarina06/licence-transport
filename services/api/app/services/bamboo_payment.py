from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.application import Application, ApplicationStatus, DeliveryFormat
from app.models.payment_transaction import PaymentStatus, PaymentTransaction
from app.services.api_bamboo_pay import BambooPayError, bamboo_pay_client
from app.services.payment import apply_payment_from_transaction


def resolve_bamboo_webhook_url() -> str:
    if settings.BAMBOO_WEBHOOK_URL:
        return settings.BAMBOO_WEBHOOK_URL
    return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/payments/webhook/bamboo"


def build_billing_id(application: Application) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    ref = application.reference
    base = ref if ref.upper().startswith("LT-") else f"LT-{ref}"
    return f"{base}-{stamp}"


async def get_latest_payment_transaction(
    db: AsyncSession, application_id: int
) -> PaymentTransaction | None:
    result = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.application_id == application_id)
        .order_by(PaymentTransaction.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def sync_payment_transaction(db: AsyncSession, transaction: PaymentTransaction) -> PaymentStatus:
    if transaction.status != PaymentStatus.PENDING:
        return transaction.status

    ids_to_try = [transaction.bamboo_ref, transaction.billing_id]
    for tx_id in ids_to_try:
        if not tx_id:
            continue
        result = await bamboo_pay_client.check_status(tx_id)
        if not result.get("success"):
            continue
        bamboo_status = result.get("status")
        if bamboo_status == "completed":
            transaction.status = PaymentStatus.COMPLETED
            if result.get("ref"):
                transaction.bamboo_ref = result["ref"]
            return PaymentStatus.COMPLETED
        if bamboo_status == "failed":
            transaction.status = PaymentStatus.FAILED
            transaction.failure_reason = (
                result.get("raw", {}).get("message")
                if isinstance(result.get("raw"), dict)
                else "Paiement refusé"
            )
            return PaymentStatus.FAILED
    return PaymentStatus.PENDING


async def finalize_completed_payment(
    db: AsyncSession,
    transaction: PaymentTransaction,
    user_id: int,
) -> Application:
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.license_type), selectinload(Application.applicant))
        .where(Application.id == transaction.application_id)
    )
    application = result.scalar_one()

    if application.status == ApplicationStatus.AWAITING_PAYMENT:
        application = await apply_payment_from_transaction(db, application, transaction, user_id)
    return application


async def apply_webhook_status(
    db: AsyncSession,
    *,
    billing_id: str,
    bamboo_status: str | None,
    bamboo_ref: str | None = None,
) -> PaymentTransaction | None:
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.billing_id == billing_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        return None

    normalized = bamboo_pay_client.normalize_status(bamboo_status)
    if normalized == "completed":
        transaction.status = PaymentStatus.COMPLETED
        if bamboo_ref:
            transaction.bamboo_ref = bamboo_ref
        app_result = await db.execute(
            select(Application).where(Application.id == transaction.application_id)
        )
        application = app_result.scalar_one()
        if application.status == ApplicationStatus.AWAITING_PAYMENT:
            await finalize_completed_payment(db, transaction, application.applicant_id)
    elif normalized == "failed":
        transaction.status = PaymentStatus.FAILED
        transaction.failure_reason = bamboo_status

    await db.flush()
    return transaction


async def initiate_instant_payment(
    db: AsyncSession,
    *,
    application: Application,
    user_full_name: str,
    phone: str,
    operator: str | None,
    delivery_format: DeliveryFormat,
    amount: float,
    user_id: int,
) -> tuple[PaymentTransaction, Application | None]:
    if not bamboo_pay_client.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Paiement BambooPay non configuré sur le serveur",
        )

    billing_id = build_billing_id(application)
    transaction = PaymentTransaction(
        application_id=application.id,
        billing_id=billing_id,
        amount=amount,
        phone=phone,
        operator=operator,
        delivery_format=delivery_format.value,
        status=PaymentStatus.PENDING,
    )
    db.add(transaction)
    await db.flush()

    try:
        bamboo_result = await bamboo_pay_client.instant_payment(
            phone=phone,
            amount=int(amount),
            payer_name=user_full_name,
            reference=billing_id,
            callback_url=resolve_bamboo_webhook_url(),
            operateur=operator,
        )
    except BambooPayError as exc:
        transaction.status = PaymentStatus.FAILED
        transaction.failure_reason = exc.technical or str(exc)
        if exc.reference_bp:
            transaction.bamboo_ref = exc.reference_bp
        await db.flush()
        detail: str | dict[str, str] = str(exc)
        if exc.technical:
            detail = {"message": str(exc), "technical": exc.technical}
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from exc

    transaction.bamboo_ref = bamboo_result.get("reference_bp") or bamboo_result.get("reference")
    await db.flush()

    # Le client valide encore sur son telephone : le polling / webhook confirmera.
    finalized_app: Application | None = None

    return transaction, finalized_app
