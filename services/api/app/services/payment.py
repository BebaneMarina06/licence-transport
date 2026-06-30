from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import Application, ApplicationStatus, ApplicationStatusHistory, DeliveryFormat
from app.models.audit import AuditLog
from app.models.payment_transaction import PaymentStatus, PaymentTransaction
from app.services.license_issue import issue_license_for_application
from app.services.mail import send_license_by_email
from app.services.sms import send_license_delivered_sms
from app.services.notifications import (
    notify_payment_confirmed,
    notify_payment_received_pending_validation,
    notify_payment_required_for_submission,
    notify_staff_new_application,
)


async def get_completed_payment_transaction(
    db: AsyncSession, application_id: int
) -> PaymentTransaction | None:
    result = await db.execute(
        select(PaymentTransaction)
        .where(
            PaymentTransaction.application_id == application_id,
            PaymentTransaction.status == PaymentStatus.COMPLETED,
        )
        .order_by(PaymentTransaction.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def assert_payment_received_for_confirmation(
    db: AsyncSession, application_id: int
) -> PaymentTransaction:
    transaction = await get_completed_payment_transaction(db, application_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Impossible de confirmer le paiement : "
                "aucun règlement Mobile Money validé n'a été enregistré pour ce dossier."
            ),
        )
    return transaction


async def register_mobile_payment_received(
    db: AsyncSession,
    application: Application,
    *,
    delivery_format: DeliveryFormat,
    amount: float,
    user_id: int,
    payment_reference: str | None = None,
) -> Application:
    """Paiement BambooPay reçu : enregistre le montant et finalise la soumission si besoin."""
    if application.status != ApplicationStatus.AWAITING_PAYMENT:
        return application

    application.delivery_format = delivery_format
    application.amount_paid = amount

    payment_comment = f"Paiement Mobile Money reçu ({delivery_format.value}) — {amount:,.0f} FCFA"
    if payment_reference:
        payment_comment += f" (réf. {payment_reference})"

    if application.submitted_at is None:
        application.status = ApplicationStatus.SUBMITTED
        application.submitted_at = datetime.now(UTC)
        payment_comment += " — dossier soumis"

        db.add(
            ApplicationStatusHistory(
                application_id=application.id,
                from_status=ApplicationStatus.AWAITING_PAYMENT,
                to_status=ApplicationStatus.SUBMITTED,
                comment=payment_comment,
                changed_by_id=user_id,
            )
        )
        db.add(
            AuditLog(
                user_id=user_id,
                action="application_submitted_with_payment",
                resource_type="application",
                resource_id=str(application.id),
                details=payment_comment,
            )
        )

        result = await db.execute(
            select(Application)
            .options(selectinload(Application.applicant), selectinload(Application.license_type))
            .where(Application.id == application.id)
        )
        application = result.scalar_one()
        await notify_staff_new_application(db, application)
        await notify_payment_received_pending_validation(db, application)
    else:
        payment_comment += " — en attente de validation backoffice"
        db.add(
            ApplicationStatusHistory(
                application_id=application.id,
                from_status=ApplicationStatus.AWAITING_PAYMENT,
                to_status=ApplicationStatus.AWAITING_PAYMENT,
                comment=payment_comment,
                changed_by_id=user_id,
            )
        )
        db.add(
            AuditLog(
                user_id=user_id,
                action="mobile_payment_received",
                resource_type="application",
                resource_id=str(application.id),
                details=payment_comment,
            )
        )

        result = await db.execute(
            select(Application)
            .options(selectinload(Application.applicant))
            .where(Application.id == application.id)
        )
        application = result.scalar_one()
        await notify_payment_received_pending_validation(db, application)

    await db.flush()
    return application


async def confirm_backoffice_payment(
    db: AsyncSession,
    application: Application,
    admin_id: int,
    *,
    comment: str | None = None,
) -> Application:
    """Validation backoffice : confirme le paiement et débloque la délivrance de licence."""
    if application.status != ApplicationStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le dossier doit être au statut payé",
        )

    transaction = await assert_payment_received_for_confirmation(db, application.id)
    application.delivery_format = DeliveryFormat(transaction.delivery_format)
    application.amount_paid = float(transaction.amount)

    if not application.paid_at:
        application.paid_at = datetime.now(UTC)

    issued = await issue_license_for_application(db, application.id)

    result = await db.execute(
        select(Application)
        .options(selectinload(Application.applicant))
        .where(Application.id == application.id)
    )
    application = result.scalar_one()
    digital = application.delivery_format == DeliveryFormat.DIGITAL

    emailed = await send_license_by_email(application, issued)
    smsed = await send_license_delivered_sms(application, issued)

    await notify_payment_confirmed(
        db, application, digital=digital, license_emailed=emailed, license_smsed=smsed
    )

    db.add(
        AuditLog(
            user_id=admin_id,
            action="license_email_sent" if emailed else "license_email_skipped",
            resource_type="application",
            resource_id=str(application.id),
            details=(
                f"Licence envoyée à {application.applicant.email}"
                if emailed
                else "E-mail non envoyé (SMTP désactivé ou adresse absente)"
            ),
        )
    )
    db.add(
        AuditLog(
            user_id=admin_id,
            action="license_sms_sent" if smsed else "license_sms_skipped",
            resource_type="application",
            resource_id=str(application.id),
            details=(
                f"SMS envoyé au {application.applicant.phone}"
                if smsed
                else "SMS non envoyé (SMS Manager désactivé ou numéro absent)"
            ),
        )
    )

    db.add(
        AuditLog(
            user_id=admin_id,
            action="payment_confirmed_backoffice",
            resource_type="application",
            resource_id=str(application.id),
            details=comment or "Paiement confirmé en backoffice",
        )
    )
    await db.flush()
    return application


async def apply_payment_from_transaction(
    db: AsyncSession,
    application: Application,
    transaction: PaymentTransaction,
    user_id: int,
) -> Application:
    delivery_format = DeliveryFormat(transaction.delivery_format)
    amount = float(transaction.amount)
    payment_ref = transaction.bamboo_ref or transaction.billing_id
    return await register_mobile_payment_received(
        db,
        application,
        delivery_format=delivery_format,
        amount=amount,
        user_id=user_id,
        payment_reference=payment_ref,
    )
