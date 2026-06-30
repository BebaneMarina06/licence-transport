import logging

from app.models.application import Application
from app.models.issued_license import IssuedLicense
from app.models.user import User
from app.services.api_bamboo_pay import BambooPayClient
from app.services.api_sms_manager import sms_manager_client

logger = logging.getLogger(__name__)


def normalize_phone_for_sms(phone: str | None) -> str | None:
    if not phone or not phone.strip():
        return None
    normalized = BambooPayClient.normalize_phone(phone.strip())
    digits = "".join(c for c in normalized if c.isdigit())
    if len(digits) < 11 or not digits.startswith("241"):
        return None
    return digits


async def send_sms_to_user(user: User, message: str) -> bool:
    """Envoie un SMS au numéro enregistré sur le compte citoyen."""
    if not sms_manager_client.is_configured():
        logger.info("SMS désactivé ou SMS Manager non configuré")
        return False

    phone = normalize_phone_for_sms(user.phone)
    if not phone:
        logger.warning("SMS ignoré : numéro invalide ou absent pour l'utilisateur %s", user.id)
        return False

    try:
        result = await sms_manager_client.send_sms(
            destination_address=phone,
            message=message,
        )
        logger.info(
            "SMS envoyé à %s (message_id=%s)",
            phone,
            result.get("message_id"),
        )
        return True
    except Exception:
        logger.exception("Échec envoi SMS vers %s", phone)
        return False


async def send_license_delivered_sms(application: Application, issued: IssuedLicense) -> bool:
    applicant = application.applicant
    if not applicant:
        return False

    message = (
        f"DGTT: Votre licence {issued.license_number} est delivree "
        f"(dossier {application.reference}). Consultez votre espace citoyen."
    )
    return await send_sms_to_user(applicant, message)
