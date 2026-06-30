"""
Client SMS Manager — API Partenaires externes v1.1

Référence : API_SMS_Manager_Partenaires (2).docx / documentation_sms_manager.pdf
Production : https://sms-manager.ventis.group/api/v1
"""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SmsManagerError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        detail: Any = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


class SmsManagerClient:
    def __init__(self) -> None:
        self.base_url = settings.SMS_MANAGER_URL.rstrip("/")

    def is_configured(self) -> bool:
        return bool(
            settings.SMS_ENABLED
            and settings.SMS_API_KEY
            and settings.SMS_API_KEY.startswith("sk_live_")
            and settings.SMS_SENDER_ID
            and self.base_url
        )

    def _headers(self) -> dict[str, str]:
        if not settings.SMS_API_KEY:
            raise SmsManagerError("Clé API SMS non configurée")
        return {
            "X-API-Key": settings.SMS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def send_sms(
        self,
        *,
        destination_address: str,
        message: str,
        sender_id: str | None = None,
        is_otp: bool = False,
    ) -> dict[str, Any]:
        if not self.is_configured():
            raise SmsManagerError("SMS Manager non configuré")

        payload = {
            "destinationAddress": destination_address,
            "message": message,
            "senderId": sender_id or settings.SMS_SENDER_ID,
            "isOTP": is_otp,
        }
        url = f"{self.base_url}/api/v1/sms"

        try:
            async with httpx.AsyncClient(timeout=settings.SMS_TIMEOUT_SECONDS) as client:
                response = await client.post(url, json=payload, headers=self._headers())
        except httpx.RequestError as exc:
            logger.exception("SMS Manager injoignable (%s)", url)
            raise SmsManagerError(f"SMS Manager injoignable : {exc}") from exc

        if response.status_code == 201:
            return response.json()

        detail: Any
        try:
            detail = response.json()
        except ValueError:
            detail = response.text[:500]

        error_message = "Échec envoi SMS"
        if isinstance(detail, dict):
            if isinstance(detail.get("detail"), str):
                error_message = detail["detail"]
            elif isinstance(detail.get("detail"), dict):
                error_message = str(detail["detail"].get("message") or detail["detail"])
            elif detail.get("message"):
                error_message = str(detail["message"])

        logger.error("SMS Manager %s → %s: %s", url, response.status_code, detail)
        raise SmsManagerError(
            error_message,
            status_code=response.status_code,
            detail=detail,
        )


sms_manager_client = SmsManagerClient()
