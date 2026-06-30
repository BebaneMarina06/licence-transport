from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.application import Application, ApplicationStatus, DeliveryFormat
from app.models.payment_transaction import PaymentStatus
from app.schemas.payment import (
    BambooWebhookPayload,
    PaymentQuoteResponse,
    PaymentRequest,
    PaymentResponse,
    PaymentStatusResponse,
)
from app.services.bamboo_payment import (
    apply_webhook_status,
    get_latest_payment_transaction,
    initiate_instant_payment,
    sync_payment_transaction,
    finalize_completed_payment,
)
from app.services.notifications import compute_payment_amount

router = APIRouter(tags=["Paiements"])


async def _get_owned_application(
    db: AsyncSession, application_id: int, user_id: int
) -> Application:
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.applicant),
            selectinload(Application.issued_license),
            selectinload(Application.status_history),
            selectinload(Application.documents),
        )
        .where(Application.id == application_id, Application.applicant_id == user_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")
    return application


@router.get("/applications/{application_id}/payment-quote", response_model=list[PaymentQuoteResponse])
async def get_payment_quotes(
    application_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    application = await _get_owned_application(db, application_id, current_user.id)
    if application.status != ApplicationStatus.AWAITING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce dossier n'est pas en attente de paiement",
        )

    lt = application.license_type
    base = float(lt.fee_amount)
    surcharge = float(lt.physical_surcharge)

    return [
        PaymentQuoteResponse(
            delivery_format=DeliveryFormat.DIGITAL,
            base_fee=base,
            physical_surcharge=0,
            total_amount=compute_payment_amount(base, surcharge, "digital"),
        ),
        PaymentQuoteResponse(
            delivery_format=DeliveryFormat.PHYSICAL,
            base_fee=base,
            physical_surcharge=surcharge,
            total_amount=compute_payment_amount(base, surcharge, "physical"),
        ),
    ]


@router.post("/applications/{application_id}/pay", response_model=PaymentResponse)
async def pay_application(
    application_id: int,
    data: PaymentRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    application = await _get_owned_application(db, application_id, current_user.id)
    if application.status != ApplicationStatus.AWAITING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce dossier n'est pas en attente de paiement",
        )

    amount = compute_payment_amount(
        float(application.license_type.fee_amount),
        float(application.license_type.physical_surcharge),
        data.delivery_format.value,
    )

    transaction, finalized_app = await initiate_instant_payment(
        db,
        application=application,
        user_full_name=current_user.full_name,
        phone=data.phone,
        operator=data.operator,
        delivery_format=data.delivery_format,
        amount=amount,
        user_id=current_user.id,
    )

    if finalized_app:
        application = finalized_app
    else:
        await db.refresh(application)

    payment_status = transaction.status.value
    if payment_status == PaymentStatus.PENDING.value:
        message = "Paiement initié. Validez la transaction sur votre téléphone (code PIN Mobile Money)."
    elif payment_status == PaymentStatus.COMPLETED.value:
        if application.submitted_at:
            message = (
                "Paiement reçu et demande soumise. "
                "La DGTT instruit votre dossier — vous serez notifié de l'avancement."
            )
        else:
            message = (
                "Paiement reçu. La DGTT valide votre règlement : "
                "votre licence sera disponible après confirmation."
            )
    else:
        message = transaction.failure_reason or "Le paiement a échoué."

    return PaymentResponse(
        application_id=application.id,
        reference=application.reference,
        delivery_format=data.delivery_format,
        amount_paid=float(application.amount_paid) if application.amount_paid else None,
        status=application.status.value,
        payment_reference=transaction.bamboo_ref or transaction.billing_id,
        payment_status=payment_status,
        billing_id=transaction.billing_id,
        bamboo_ref=transaction.bamboo_ref,
        message=message,
    )


@router.get("/applications/{application_id}/payment-status", response_model=PaymentStatusResponse)
async def get_payment_status(
    application_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    application = await _get_owned_application(db, application_id, current_user.id)
    transaction = await get_latest_payment_transaction(db, application.id)
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucun paiement en cours")

    if transaction.status == PaymentStatus.PENDING:
        await sync_payment_transaction(db, transaction)
        if transaction.status == PaymentStatus.COMPLETED:
            await finalize_completed_payment(db, transaction, current_user.id)
            await db.refresh(application)

    if transaction.status == PaymentStatus.PENDING:
        message = "En attente de validation sur votre téléphone..."
    elif transaction.status == PaymentStatus.COMPLETED:
        if application.status == ApplicationStatus.SUBMITTED:
            message = (
                "Paiement reçu et demande soumise. "
                "La DGTT instruit votre dossier — vous serez notifié de l'avancement."
            )
        elif application.status == ApplicationStatus.AWAITING_PAYMENT:
            message = (
                "Paiement reçu. Validation par la DGTT en cours — "
                "votre licence sera disponible après confirmation."
            )
        else:
            message = "Paiement confirmé."
    else:
        message = transaction.failure_reason or "Paiement échoué."

    await db.refresh(application)
    return PaymentStatusResponse(
        billing_id=transaction.billing_id,
        payment_status=transaction.status.value,
        bamboo_ref=transaction.bamboo_ref,
        application_status=application.status.value,
        message=message,
    )


@router.post("/payments/webhook/bamboo")
async def bamboo_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        data = await request.json()
    except Exception:
        data = {}

    if not isinstance(data, dict):
        return {"status": "ignored", "reason": "payload invalide"}

    try:
        payload = BambooWebhookPayload.model_validate(data)
    except Exception:
        return {"status": "ignored", "reason": "payload invalide"}

    billing_id = payload.billingId or payload.billing_id
    if not billing_id:
        return {"status": "ignored", "reason": "billing_id manquant"}

    await apply_webhook_status(
        db,
        billing_id=billing_id,
        bamboo_status=payload.status,
        bamboo_ref=payload.ref,
    )
    return {"status": "ok"}
