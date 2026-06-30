from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.license_type import LicenseType
from app.models.platform_label import PlatformLabel
from app.models.platform_setting import PlatformSetting
from app.models.user import User, UserRole

# Source officielle :
# https://infrastructures.gouv.ga/18-transport/20-documents-administratifs/329-licence-de-transport/
LICENSE_TYPES = [
    {
        "code": "AST",
        "name": "Autorisation Spéciale de Transport",
        "name_en": "Special Transport Authorization",
        "description": "Autorisation spéciale pour des opérations de transport ponctuelles ou particulières.",
        "description_en": "Special authorization for occasional or specific transport operations.",
        "fee_amount": 50000,
        "physical_surcharge": 25000,
        "validity_months": 12,
        "required_documents": "Photocopie carte grise,Photocopie visite technique,Photocopie assurance",
    },
    {
        "code": "MIXTE",
        "name": "Licence Mixte",
        "name_en": "Mixed Transport License",
        "description": "Licence autorisant le transport combiné de personnes et de marchandises.",
        "description_en": "License for combined passenger and freight transport.",
        "fee_amount": 200000,
        "physical_surcharge": 50000,
        "validity_months": 12,
        "required_documents": "Photocopie carte grise,Photocopie visite technique,Photocopie assurance",
    },
    {
        "code": "VOYAGEURS",
        "name": "Licence de transports voyageurs",
        "name_en": "Passenger Transport License",
        "description": "Licence pour le transport de voyageurs (véhicule de moins de 18 places).",
        "description_en": "License for passenger transport (vehicles with fewer than 18 seats).",
        "fee_amount": 150000,
        "physical_surcharge": 40000,
        "validity_months": 12,
        "required_documents": "Photocopie carte grise,Photocopie visite technique,Photocopie assurance",
    },
    {
        "code": "MARCHANDISES",
        "name": "Licence de transports marchandises",
        "name_en": "Freight Transport License",
        "description": "Licence pour le transport routier de marchandises (tarif variable selon le tonnage).",
        "description_en": "License for road freight transport (fee varies by tonnage).",
        "fee_amount": 300000,
        "physical_surcharge": 75000,
        "validity_months": 12,
        "required_documents": "Photocopie carte grise,Photocopie visite technique,Photocopie assurance",
    },
    {
        "code": "EXCEPTIONNELLE",
        "name": "Licence Exceptionnelle",
        "name_en": "Exceptional Transport License",
        "description": "Licence pour le transport exceptionnel de charges lourdes (gros porteur).",
        "description_en": "License for exceptional heavy load transport (heavy hauler).",
        "fee_amount": 400000,
        "physical_surcharge": 100000,
        "validity_months": 12,
        "required_documents": "Photocopie carte grise,Photocopie visite technique,Photocopie assurance",
    },
]

PLATFORM_LABELS = [
    {
        "key": "portal.title",
        "category": "portal",
        "label_fr": "Licences de Transport",
        "label_en": "Transport Licenses",
        "description": "Titre principal du portail",
    },
    {
        "key": "portal.subtitle",
        "category": "portal",
        "label_fr": "République Gabonaise — DGTT",
        "label_en": "Gabonese Republic — DGTT",
    },
    {
        "key": "portal.hero.title",
        "category": "portal",
        "label_fr": "Demandez votre licence de transport en ligne",
        "label_en": "Apply for your transport license online",
    },
    {
        "key": "portal.hero.subtitle",
        "category": "portal",
        "label_fr": "Plateforme officielle de la Direction Générale des Transports Terrestres",
        "label_en": "Official platform of the General Directorate of Land Transport",
    },
    {
        "key": "portal.cta.apply",
        "category": "portal",
        "label_fr": "Faire une demande",
        "label_en": "Start application",
    },
    {
        "key": "portal.cta.login",
        "category": "portal",
        "label_fr": "Se connecter",
        "label_en": "Sign in",
    },
    {
        "key": "backoffice.title",
        "category": "backoffice",
        "label_fr": "Backoffice DGTT",
        "label_en": "DGTT Backoffice",
    },
]

ADMIN_EMAIL = "admin@dgtt.ga"
ADMIN_PASSWORD = "Admin@2026!"

STAFF_ACCOUNTS = [
    {
        "email": "agent@dgtt.ga",
        "password": "Agent@2026!",
        "full_name": "Agent Instruction",
        "role": UserRole.AGENT,
    },
    {
        "email": "superviseur@dgtt.ga",
        "password": "Super@2026!",
        "full_name": "Superviseur DGTT",
        "role": UserRole.SUPERVISOR,
    },
    {
        "email": "auditeur@dgtt.ga",
        "password": "Audit@2026!",
        "full_name": "Auditeur DGTT",
        "role": UserRole.AUDITOR,
    },
]


async def _ensure_staff_user(db, email: str, password: str, full_name: str, role: UserRole):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        db.add(
            User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                role=role,
            )
        )


async def seed_database():
    """Données initiales : insertion uniquement si absentes (ne pas écraser les modifications backoffice)."""
    async with AsyncSessionLocal() as db:
        for lt_data in LICENSE_TYPES:
            result = await db.execute(select(LicenseType).where(LicenseType.code == lt_data["code"]))
            if not result.scalar_one_or_none():
                db.add(LicenseType(**lt_data))

        admin_result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        if not admin_result.scalar_one_or_none():
            db.add(
                User(
                    email=ADMIN_EMAIL,
                    hashed_password=get_password_hash(ADMIN_PASSWORD),
                    full_name="Administrateur DGTT",
                    role=UserRole.ADMIN,
                )
            )

        for account in STAFF_ACCOUNTS:
            await _ensure_staff_user(
                db,
                account["email"],
                account["password"],
                account["full_name"],
                account["role"],
            )

        for label_data in PLATFORM_LABELS:
            label_result = await db.execute(
                select(PlatformLabel).where(PlatformLabel.key == label_data["key"])
            )
            if not label_result.scalar_one_or_none():
                db.add(PlatformLabel(**label_data))

        ocr_result = await db.execute(
            select(PlatformSetting).where(PlatformSetting.key == "ocr.enabled")
        )
        if not ocr_result.scalar_one_or_none():
            db.add(
                PlatformSetting(
                    key="ocr.enabled",
                    value="false",
                    description="Lecture automatique OCR des pièces justificatives",
                )
            )

        await db.commit()
