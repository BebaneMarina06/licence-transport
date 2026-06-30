"""
Client BambooPay — API_Bamboo_PAY-v9_TEST.pdf

Flux B — paiement instantané (sans redirection) :
- POST {BAMBOO_API_URL}/mobile/instant-payment
- Succès HTTP 202, status=true → reference_bp
- Échec métier HTTP 400, status=false → message d'erreur

Flux C — vérification statut :
- POST {BAMBOO_API_URL}/check-status/{transaction_id}

URLs (config BAMBOO_API_URL) :
- TEST : https://devfront-bamboopay.ventis.group/api
- PROD v2 : https://client-v2.bamboopay-ga.com/api
"""

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BAMBOO_USER_ERROR_MESSAGE = (
    "Le paiement mobile est momentanément indisponible. "
    "Réessayez dans quelques instants."
)

INSTANT_PAYMENT_OPERATORS = frozenset({"airtel_money", "moov_money"})


class BambooPayError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        technical: str | None = None,
        reference_bp: str | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.technical = technical
        self.reference_bp = reference_bp


class BambooPayClient:
    def __init__(self) -> None:
        self.base_url = settings.BAMBOO_API_URL.rstrip("/")
        self.username = settings.BAMBOO_USERNAME
        self.password = settings.BAMBOO_PASSWORD
        self.merchant_id = settings.BAMBOO_MERCHANT_ID

    def is_configured(self) -> bool:
        return bool(self.username and self.password and self.merchant_id and self.base_url)

    def _auth(self) -> httpx.BasicAuth:
        if not self.is_configured():
            raise BambooPayError("BambooPay non configuré", code="BAMBOO_NOT_CONFIGURED")
        return httpx.BasicAuth(self.username, self.password)

    def _timeout(self) -> httpx.Timeout:
        return httpx.Timeout(
            connect=settings.BAMBOO_CONNECT_TIMEOUT_SECONDS,
            read=settings.BAMBOO_TIMEOUT_SECONDS,
            write=settings.BAMBOO_TIMEOUT_SECONDS,
            pool=settings.BAMBOO_CONNECT_TIMEOUT_SECONDS,
        )

    @staticmethod
    def normalize_phone(phone: str) -> str:
        digits = re.sub(r"\D", "", phone or "")
        if not digits:
            return phone
        if digits.startswith("241"):
            return digits
        if digits.startswith("0") and len(digits) >= 9:
            return "241" + digits[1:]
        if len(digits) == 8:
            return "241" + digits
        return digits if digits.startswith("241") else f"241{digits}"

    @staticmethod
    def normalize_phone_for_instant_payment(phone: str, operateur: str | None = None) -> str:
        """
        Format téléphone selon l'opérateur (comportement BambooPay v9 TEST).

        - Airtel : local 07XXXXXXXX (sans préfixe 241) — Postman / API opérateur.
        - Moov : 241XXXXXXXX accepté.
        """
        digits = re.sub(r"\D", "", phone or "")
        if not digits:
            return phone

        mapped = BambooPayClient.map_operator(operateur)

        if mapped == "airtel_money":
            if digits.startswith("241") and len(digits) >= 11:
                return "0" + digits[3:]
            if digits.startswith("0") and len(digits) >= 9:
                return digits
            if len(digits) == 8:
                return "0" + digits
            return digits

        return BambooPayClient.normalize_phone(phone)

    @staticmethod
    def map_operator(operator: str | None) -> str | None:
        """Doc v9 : operateur = moov_money | airtel_money (ou null)."""
        if not operator:
            return None
        mapping = {
            "airtel": "airtel_money",
            "moov": "moov_money",
            "airtel_money": "airtel_money",
            "moov_money": "moov_money",
        }
        mapped = mapping.get(operator.lower().strip())
        if mapped and mapped not in INSTANT_PAYMENT_OPERATORS:
            return None
        return mapped

    @staticmethod
    def normalize_status(raw: str | None) -> str | None:
        if not raw:
            return None
        value = str(raw).lower().strip()
        if value in {
            "completed",
            "success",
            "succes",
            "paid",
            "paye",
            "payé",
            "valide",
            "valid",
            "ok",
            "true",
        }:
            return "completed"
        if value in {
            "failed",
            "fail",
            "echec",
            "échec",
            "error",
            "rejected",
            "refused",
            "cancelled",
            "canceled",
            "false",
        }:
            return "failed"
        if value in {"pending", "en_attente", "processing", "waiting"}:
            return "pending"
        return None

    @staticmethod
    def _parse_status_payload(data: dict[str, Any]) -> dict[str, Any]:
        transaction = data.get("transaction")
        if transaction is None and data.get("body"):
            raw_body = data.get("body")
            try:
                inner = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
            except (json.JSONDecodeError, TypeError):
                inner = {}
            if isinstance(inner, dict):
                transaction = inner.get("transaction") or inner
        if not isinstance(transaction, dict):
            transaction = {}

        status = (
            transaction.get("status")
            or transaction.get("etat")
            or transaction.get("state")
            or data.get("status")
        )
        ref = (
            transaction.get("ref")
            or transaction.get("reference")
            or transaction.get("reference_bp")
            or data.get("ref")
        )
        billing_id = transaction.get("billingId") or transaction.get("billing_id") or data.get("billingId")
        return {
            "status": BambooPayClient.normalize_status(str(status) if status is not None else None)
            or (str(status).lower() if status is not None else None),
            "ref": ref,
            "billing_id": billing_id,
            "raw_status": status,
            "transaction": transaction,
        }

    @staticmethod
    def _format_json_error(data: dict[str, Any]) -> str:
        for key in ("message", "detail", "error"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        parts: list[str] = []
        for field, errors in data.items():
            if field in ("message", "detail", "error", "code", "status", "reference_bp", "reference"):
                continue
            if isinstance(errors, list):
                for item in errors:
                    if isinstance(item, str) and item.strip():
                        parts.append(f"{field}: {item.strip()}")
            elif isinstance(errors, str) and errors.strip():
                parts.append(f"{field}: {errors.strip()}")
        if parts:
            return "; ".join(parts)
        return json.dumps(data, ensure_ascii=False)[:500]

    @staticmethod
    def _extract_http_error_detail(response: httpx.Response) -> str:
        text = (response.text or "").strip()
        if not text:
            return f"HTTP {response.status_code}"

        try:
            data = response.json()
        except Exception:
            data = None

        if isinstance(data, dict):
            return BambooPayClient._format_json_error(data)

        if "<html" in text.lower():
            match = re.search(
                r'class="[^"]*font-semibold[^"]*"[^>]*>\s*([^<]+)\s*<',
                text,
                re.IGNORECASE,
            )
            if match:
                return match.group(1).strip()
            return f"HTTP {response.status_code} (réponse HTML du service de paiement)"

        if len(text) > 500:
            return text[:500] + "..."
        return text

    @classmethod
    def _raise_http_error(cls, response: httpx.Response, *, context: str) -> None:
        technical = cls._extract_http_error_detail(response)
        logger.error(
            "%s failed: status=%s detail=%s",
            context,
            response.status_code,
            technical,
        )
        raise BambooPayError(
            BAMBOO_USER_ERROR_MESSAGE,
            code=f"BAMBOO_HTTP_{response.status_code}",
            status_code=response.status_code,
            technical=technical,
        )

    @classmethod
    def _raise_instant_payment_failure(
        cls,
        data: dict[str, Any],
        *,
        http_status: int,
        code: str,
    ) -> None:
        technical = (data.get("message") or "Paiement refusé").strip() if data.get("message") else "Paiement refusé"
        logger.error(
            "BambooPay instant payment refused: status=%s detail=%s ref=%s",
            http_status,
            technical,
            data.get("reference_bp"),
        )
        raise BambooPayError(
            BAMBOO_USER_ERROR_MESSAGE,
            code=code,
            status_code=http_status,
            technical=technical,
            reference_bp=data.get("reference_bp"),
        )

    @classmethod
    def _parse_instant_payment_success(cls, data: dict[str, Any], reference: str) -> dict[str, Any]:
        if data.get("status") is False:
            cls._raise_instant_payment_failure(data, http_status=202, code="BAMBOO_PAYMENT_FAILED")
        return {
            "success": True,
            "reference_bp": data.get("reference_bp"),
            "reference": data.get("reference") or reference,
            "message": data.get("message"),
            "raw": data,
        }

    async def instant_payment(
        self,
        *,
        phone: str,
        amount: int,
        payer_name: str,
        reference: str,
        callback_url: str,
        operateur: str | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/mobile/instant-payment"
        payload: dict[str, Any] = {
            "phone": self.normalize_phone_for_instant_payment(phone, operateur),
            "amount": str(int(amount)),
            "payer_name": payer_name,
            "reference": reference,
            "merchant_id": self.merchant_id,
            "callback_url": callback_url,
        }
        mapped_operator = self.map_operator(operateur)
        if mapped_operator:
            payload["operateur"] = mapped_operator

        if settings.BAMBOO_DEBUG:
            safe = {**payload, "merchant_id": "***"}
            logger.debug("[BAMBOO] POST %s payload=%s", url, safe)

        async with httpx.AsyncClient(verify=settings.BAMBOO_VERIFY_SSL, timeout=self._timeout()) as client:
            response = await client.post(url, json=payload, auth=self._auth())

        if settings.BAMBOO_DEBUG:
            logger.debug("[BAMBOO] HTTP %s body=%s", response.status_code, response.text[:500])

        if response.status_code == 202:
            return self._parse_instant_payment_success(response.json(), reference)

        if response.status_code == 400:
            try:
                data = response.json()
            except Exception:
                self._raise_http_error(response, context="BambooPay instant payment")
            if isinstance(data, dict) and data.get("status") is False:
                # BambooPay peut renvoyer 400 + message générique alors que le push USSD
                # est bien parti (reference_bp présent) — traiter comme initiation en cours.
                if data.get("reference_bp"):
                    logger.warning(
                        "BambooPay HTTP 400 avec reference_bp=%s — initiation traitée comme pending",
                        data.get("reference_bp"),
                    )
                    return {
                        "success": True,
                        "pending_confirmation": True,
                        "reference_bp": data.get("reference_bp"),
                        "reference": data.get("reference") or reference,
                        "message": data.get("message"),
                        "raw": data,
                    }
                self._raise_instant_payment_failure(
                    data,
                    http_status=400,
                    code="BAMBOO_PAYMENT_FAILED",
                )

        self._raise_http_error(response, context="BambooPay instant payment")

    async def check_status(self, transaction_id: str) -> dict[str, Any]:
        """Doc v9 : POST /check-status/{id} — repli GET si le serveur renvoie 405."""
        url = f"{self.base_url}/check-status/{transaction_id}"

        if settings.BAMBOO_DEBUG:
            logger.debug("[BAMBOO] POST %s", url)

        async with httpx.AsyncClient(verify=settings.BAMBOO_VERIFY_SSL, timeout=self._timeout()) as client:
            response = await client.post(url, auth=self._auth())
            if response.status_code == 405:
                if settings.BAMBOO_DEBUG:
                    logger.debug("[BAMBOO] POST 405, fallback GET %s", url)
                response = await client.get(url, auth=self._auth())

        if settings.BAMBOO_DEBUG:
            logger.debug("[BAMBOO] HTTP %s body=%s", response.status_code, response.text[:500])

        try:
            data = response.json()
        except Exception:
            data = {"raw": response.text}

        parsed = self._parse_status_payload(data) if isinstance(data, dict) else {}
        if response.status_code == 200 and parsed.get("status"):
            return {
                "success": True,
                "status": parsed["status"],
                "ref": parsed.get("ref"),
                "billing_id": parsed.get("billing_id"),
                "raw": data,
            }

        detail = data.get("message") if isinstance(data, dict) else response.text
        return {
            "success": False,
            "status_code": response.status_code,
            "detail": detail,
            "raw": data,
        }


bamboo_pay_client = BambooPayClient()
