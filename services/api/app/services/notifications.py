import asyncio
import logging
from dataclasses import dataclass
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.application import Application
from app.models.notification import Notification
from app.models.user import User
from app.services.mail import send_plain_email_to_user
from app.services.sms import send_sms_to_user
from app.services.staff import STAFF_NOTIFY_NEW_APPLICATION_ROLES

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StaffOutboundRecipient:
    id: int
    email: str | None
    phone: str | None


async def _send_staff_outbound_notifications(
    recipients: list[StaffOutboundRecipient],
    *,
    sms_message: str,
    email_subject: str,
    email_body: str,
) -> None:
    async def notify_one(recipient: StaffOutboundRecipient) -> None:
        user = SimpleNamespace(id=recipient.id, email=recipient.email, phone=recipient.phone)
        results = await asyncio.gather(
            send_sms_to_user(user, sms_message),
            send_plain_email_to_user(user, subject=email_subject, body=email_body),
            return_exceptions=True,
        )
        for channel, result in zip(("SMS", "e-mail"), results, strict=True):
            if isinstance(result, Exception):
                logger.warning(
                    "Notification %s échouée pour l'utilisateur %s : %s",
                    channel,
                    recipient.id,
                    result,
                )

    await asyncio.gather(
        *[notify_one(recipient) for recipient in recipients],
        return_exceptions=True,
    )


async def create_notification(
    db: AsyncSession,
    *,
    user: User,
    title: str,
    message: str,
    link: str | None = None,
    application_id: int | None = None,
) -> Notification:
    notification = Notification(
        user_id=user.id,
        application_id=application_id,
        title=title,
        message=message,
        link=link,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_awaiting_payment(db: AsyncSession, application: Application) -> None:
    await create_notification(
        db,
        user=application.applicant,
        application_id=application.id,
        title="Dossier validé — Paiement requis",
        message=(
            f"Votre dossier {application.reference} a été approuvé. "
            "Procédez au paiement pour obtenir votre licence."
        ),
        link=f"/dossier/{application.id}",
    )
    await send_sms_to_user(
        application.applicant,
        f"DGTT: Dossier {application.reference} approuve. "
        "Connectez-vous pour proceder au paiement de votre licence.",
    )


async def notify_payment_required_for_submission(db: AsyncSession, application: Application) -> None:
    await create_notification(
        db,
        user=application.applicant,
        application_id=application.id,
        title="Paiement requis pour soumettre",
        message=(
            f"Votre dossier {application.reference} est prêt. "
            "Réglez les frais de licence pour finaliser votre demande."
        ),
        link=f"/dossier/{application.id}",
    )
    await send_sms_to_user(
        application.applicant,
        f"DGTT: Finalisez votre demande {application.reference} "
        "en procedant au paiement sur le portail.",
    )


async def notify_payment_received_pending_validation(
    db: AsyncSession, application: Application
) -> None:
    await create_notification(
        db,
        user=application.applicant,
        application_id=application.id,
        title="Paiement reçu",
        message=(
            f"Votre paiement pour le dossier {application.reference} a bien été reçu. "
            "La DGTT valide votre règlement : votre licence sera disponible après confirmation."
        ),
        link=f"/dossier/{application.id}",
    )
    await send_sms_to_user(
        application.applicant,
        f"DGTT: Paiement recu pour {application.reference}. "
        "Validation en cours — vous serez notifie des que la licence sera disponible.",
    )


async def notify_payment_confirmed(
    db: AsyncSession,
    application: Application,
    digital: bool,
    *,
    license_emailed: bool = False,
    license_smsed: bool = False,
) -> None:
    delivery_hints: list[str] = []
    if license_emailed:
        delivery_hints.append("une copie PDF par e-mail")
    if license_smsed:
        delivery_hints.append("un SMS de confirmation")
    delivery_hint = ""
    if delivery_hints:
        delivery_hint = f" Vous avez recu {' et '.join(delivery_hints)}."
    if digital:
        message = (
            f"Paiement confirmé pour {application.reference}. "
            f"Votre licence numérique est disponible au téléchargement.{delivery_hint}"
        )
    else:
        message = (
            f"Paiement confirmé pour {application.reference}. "
            f"Votre licence PDF est disponible. La carte physique sera expédiée sous peu.{delivery_hint}"
        )
    await create_notification(
        db,
        user=application.applicant,
        application_id=application.id,
        title="Paiement confirmé",
        message=message,
        link=f"/dossier/{application.id}",
    )
    if not license_smsed:
        await send_sms_to_user(
            application.applicant,
            f"DGTT: Paiement confirme pour {application.reference}. "
            "Votre licence est disponible dans votre espace citoyen.",
        )


async def notify_physical_delivered(db: AsyncSession, application: Application) -> None:
    await create_notification(
        db,
        user=application.applicant,
        application_id=application.id,
        title="Licence physique délivrée",
        message=f"Votre carte physique pour le dossier {application.reference} a été délivrée.",
        link=f"/dossier/{application.id}",
    )


async def notify_staff_new_application(
    db: AsyncSession,
    application: Application,
    *,
    resubmit: bool = False,
) -> None:
    """Alerte les agents actifs (SMS, e-mail, notification in-app) à chaque nouvelle soumission."""
    result = await db.execute(
        select(User).where(
            User.role.in_(tuple(STAFF_NOTIFY_NEW_APPLICATION_ROLES)),
            User.is_active.is_(True),
        )
    )
    staff_users = result.scalars().all()
    if not staff_users:
        return

    applicant_name = application.applicant.full_name if application.applicant else "Demandeur"
    license_type = application.license_type.name if application.license_type else "—"
    admin_link = f"/admin/dossiers/{application.id}"
    portal_url = f"{settings.FRONTEND_URL.rstrip('/')}{admin_link}"

    if resubmit:
        title = "Dossier resoumis"
        message = (
            f"Le dossier {application.reference} a été resoumis après complément "
            f"({applicant_name}, {license_type})."
        )
        sms_message = (
            f"DGTT: Dossier {application.reference} resoumis par {applicant_name}. "
            "Consultez le backoffice."
        )
    else:
        title = "Nouvelle demande"
        message = (
            f"Nouveau dossier {application.reference} soumis par {applicant_name} "
            f"({license_type})."
        )
        sms_message = (
            f"DGTT: Nouvelle demande {application.reference} ({applicant_name}). "
            "Consultez le backoffice."
        )

    email_body = f"""Bonjour,

{message}

Consulter le dossier :
{portal_url}

— {settings.MAIL_FROM_NAME}
"""

    for staff in staff_users:
        await create_notification(
            db,
            user=staff,
            application_id=application.id,
            title=title,
            message=message,
            link=admin_link,
        )

    recipients = [
        StaffOutboundRecipient(id=staff.id, email=staff.email, phone=staff.phone)
        for staff in staff_users
    ]
    asyncio.create_task(
        _send_staff_outbound_notifications(
            recipients,
            sms_message=sms_message,
            email_subject=f"DGTT — {title}",
            email_body=email_body,
        )
    )


def compute_payment_amount(fee_amount: float, physical_surcharge: float, delivery_format: str) -> float:
    base = float(fee_amount)
    if delivery_format == "physical":
        return base + float(physical_surcharge)
    return base
