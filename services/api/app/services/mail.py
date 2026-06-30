import asyncio
import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate
from pathlib import Path

from app.core.config import settings
from app.models.application import Application
from app.models.issued_license import IssuedLicense
from app.models.user import User
from app.services.license_issue import get_license_pdf_path

logger = logging.getLogger(__name__)


def _build_license_email(
    *,
    to_email: str,
    holder_name: str,
    license_number: str,
    application_reference: str,
    license_type_name: str,
    expires_at_label: str,
    portal_url: str,
    pdf_bytes: bytes,
    pdf_filename: str,
) -> MIMEMultipart:
    msg = MIMEMultipart()
    msg["From"] = formataddr((settings.MAIL_FROM_NAME, settings.MAIL_FROM_ADDRESS))
    msg["To"] = to_email
    msg["Subject"] = f"Votre licence de transport {license_number}"
    msg["Date"] = formatdate(localtime=True)

    body = f"""Bonjour {holder_name},

Votre licence de transport a été délivrée par la Direction Générale des Transports Terrestres (DGTT).

Référence dossier : {application_reference}
Numéro de licence : {license_number}
Type : {license_type_name}
Valide jusqu'au : {expires_at_label}

Votre licence au format PDF est jointe à cet e-mail. Vous pouvez également la consulter dans votre espace citoyen :
{portal_url}

Ce document comporte un QR code permettant de vérifier son authenticité.

— {settings.MAIL_FROM_NAME}
"""
    msg.attach(MIMEText(body, "plain", "utf-8"))

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=pdf_filename)
    msg.attach(attachment)
    return msg


def _send_smtp_message(message: MIMEMultipart, recipients: list[str]) -> None:
    encryption = (settings.MAIL_ENCRYPTION or "false").strip().lower()
    ehlo_domain = settings.MAIL_EHLO_DOMAIN or None
    timeout = settings.MAIL_TIMEOUT_SECONDS

    if encryption == "ssl":
        server: smtplib.SMTP = smtplib.SMTP_SSL(
            settings.MAIL_HOST,
            settings.MAIL_PORT,
            local_hostname=ehlo_domain,
            timeout=timeout,
        )
    else:
        server = smtplib.SMTP(
            settings.MAIL_HOST,
            settings.MAIL_PORT,
            local_hostname=ehlo_domain,
            timeout=timeout,
        )

    try:
        server.ehlo()
        if encryption == "tls":
            server.starttls()
            server.ehlo()
        if settings.MAIL_USE_AUTH and settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM_ADDRESS, recipients, message.as_string())
    finally:
        try:
            server.quit()
        except smtplib.SMTPException:
            server.close()


def _send_plain_email_sync(*, to_email: str, subject: str, body: str) -> None:
    msg = MIMEMultipart()
    msg["From"] = formataddr((settings.MAIL_FROM_NAME, settings.MAIL_FROM_ADDRESS))
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg.attach(MIMEText(body, "plain", "utf-8"))
    _send_smtp_message(msg, [to_email])


async def send_plain_email_to_user(user: User, *, subject: str, body: str) -> bool:
    """Envoie un e-mail texte simple à un utilisateur."""
    if not settings.mail_is_configured:
        logger.info("Envoi e-mail désactivé ou SMTP non configuré")
        return False
    if not user.email or not user.email.strip():
        logger.warning("E-mail ignoré : adresse absente pour l'utilisateur %s", user.id)
        return False

    to_email = user.email.strip()
    try:
        await asyncio.to_thread(
            _send_plain_email_sync,
            to_email=to_email,
            subject=subject,
            body=body,
        )
        logger.info("E-mail envoyé à %s — %s", to_email, subject)
        return True
    except Exception:
        logger.exception("Échec envoi e-mail vers %s", to_email)
        return False


def _send_license_email_sync(
    *,
    to_email: str,
    holder_name: str,
    license_number: str,
    application_reference: str,
    license_type_name: str,
    expires_at_label: str,
    portal_url: str,
    pdf_path: str,
    pdf_filename: str,
) -> None:
    pdf_bytes = Path(pdf_path).read_bytes()
    message = _build_license_email(
        to_email=to_email,
        holder_name=holder_name,
        license_number=license_number,
        application_reference=application_reference,
        license_type_name=license_type_name,
        expires_at_label=expires_at_label,
        portal_url=portal_url,
        pdf_bytes=pdf_bytes,
        pdf_filename=pdf_filename,
    )
    _send_smtp_message(message, [to_email])


async def send_license_by_email(application: Application, issued: IssuedLicense) -> bool:
    """Envoie la licence PDF à l'adresse e-mail du demandeur."""
    if not settings.mail_is_configured:
        logger.info("Envoi e-mail désactivé ou SMTP non configuré")
        return False

    applicant = application.applicant
    if not applicant or not applicant.email:
        logger.warning(
            "Licence %s : aucun e-mail pour le dossier %s",
            issued.license_number,
            application.reference,
        )
        return False

    to_email = applicant.email.strip()
    try:
        pdf_path = get_license_pdf_path(application.id, issued.pdf_filename)
        expires_at_label = issued.expires_at.strftime("%d/%m/%Y")
        portal_url = f"{settings.FRONTEND_URL.rstrip('/')}/dossier/{application.id}"

        await asyncio.to_thread(
            _send_license_email_sync,
            to_email=to_email,
            holder_name=applicant.full_name,
            license_number=issued.license_number,
            application_reference=application.reference,
            license_type_name=issued.license_type_name,
            expires_at_label=expires_at_label,
            portal_url=portal_url,
            pdf_path=str(pdf_path),
            pdf_filename=f"{issued.license_number}.pdf",
        )
        logger.info(
            "Licence %s envoyée par e-mail à %s (dossier %s)",
            issued.license_number,
            to_email,
            application.reference,
        )
        return True
    except Exception:
        logger.exception(
            "Échec envoi e-mail licence %s vers %s",
            issued.license_number,
            to_email,
        )
        return False
