from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://licence_user:licence_pass@localhost:5432/licence_transport"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def _force_asyncpg_driver(cls, value: str) -> str:
        """Render fournit une URL `postgres://` ou `postgresql://`.

        SQLAlchemy en mode async exige le driver asyncpg : on normalise le schéma
        et on retire le paramètre `sslmode` que asyncpg ne comprend pas.
        """
        if value.startswith("postgres://"):
            value = "postgresql+asyncpg://" + value[len("postgres://"):]
        elif value.startswith("postgresql://"):
            value = "postgresql+asyncpg://" + value[len("postgresql://"):]

        if "sslmode=" in value:
            from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse

            parsed = urlparse(value)
            query = [(k, v) for k, v in parse_qsl(parsed.query) if k != "sslmode"]
            value = urlunparse(parsed._replace(query=urlencode(query)))
        return value
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "changez-moi-en-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    APP_NAME: str = "Licence Transport Gabon"
    API_V1_PREFIX: str = "/api/v1"
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 5
    ALLOWED_UPLOAD_EXTENSIONS: str = "pdf,jpg,jpeg,png"
    PUBLIC_API_URL: str = "http://127.0.0.1:8010"
    LICENSES_DIR: str = "uploads/licenses"
    FRONTEND_URL: str = "http://localhost:5173"
    # TEST (v9) : devfront-bamboopay.ventis.group — PROD v2 : client-v2.bamboopay-ga.com
    BAMBOO_API_URL: str = "https://devfront-bamboopay.ventis.group/api"
    BAMBOO_USERNAME: str = ""
    BAMBOO_PASSWORD: str = ""
    BAMBOO_MERCHANT_ID: str = ""
    BAMBOO_RETURN_URL: str = "http://localhost/payment/result"
    BAMBOO_WEBHOOK_URL: str = "http://127.0.0.1:8010/api/payments/webhook/bamboo"
    BAMBOO_VERIFY_SSL: bool = True
    BAMBOO_DEBUG: bool = True
    BAMBOO_TIMEOUT_SECONDS: float = 60.0
    BAMBOO_CONNECT_TIMEOUT_SECONDS: float = 15.0

    MAIL_HOST: str = ""
    MAIL_PORT: int = 25
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM_ADDRESS: str = ""
    MAIL_FROM_NAME: str = "DGTT - Licences de transport"
    MAIL_ENCRYPTION: str = "false"  # false | tls | ssl
    MAIL_EHLO_DOMAIN: str = ""
    MAIL_USE_AUTH: bool = False  # relais interne port 25 sans AUTH
    MAIL_ENABLED: bool = True
    MAIL_TIMEOUT_SECONDS: float = 5.0

    SMS_MANAGER_URL: str = "https://sms-manager.ventis.group"
    SMS_API_KEY: str = ""
    SMS_SENDER_ID: str = ""
    SMS_ENABLED: bool = True
    SMS_TIMEOUT_SECONDS: float = 30.0

    @property
    def mail_is_configured(self) -> bool:
        return bool(self.MAIL_ENABLED and self.MAIL_HOST and self.MAIL_FROM_ADDRESS)

    @property
    def sms_is_configured(self) -> bool:
        return bool(
            self.SMS_ENABLED
            and self.SMS_API_KEY.startswith("sk_live_")
            and self.SMS_SENDER_ID
            and self.SMS_MANAGER_URL
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_extensions(self) -> set[str]:
        return {ext.strip().lower() for ext in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")}


settings = Settings()
