from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.issued_license import IssuedLicense
from app.schemas.issued_license import LicenseVerificationResponse
from app.services.license_issue import compute_verification_sig

router = APIRouter(prefix="/verify", tags=["Vérification publique"])


@router.get("/{license_number}", response_model=LicenseVerificationResponse)
async def verify_license(
    license_number: str,
    db: AsyncSession = Depends(get_db),
    sig: str = Query(..., min_length=8, max_length=64),
):
    expected_sig = compute_verification_sig(license_number)
    if not hmac_compare(sig, expected_sig):
        return LicenseVerificationResponse(
            valid=False,
            license_number=license_number,
            status="invalid",
            message="Signature de vérification invalide.",
        )

    result = await db.execute(
        select(IssuedLicense).where(IssuedLicense.license_number == license_number)
    )
    license_record = result.scalar_one_or_none()
    if not license_record:
        return LicenseVerificationResponse(
            valid=False,
            license_number=license_number,
            status="not_found",
            message="Licence introuvable dans le registre national.",
        )

    now = datetime.now(UTC)
    expires = license_record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)

    if license_record.is_revoked:
        return LicenseVerificationResponse(
            valid=False,
            license_number=license_number,
            holder_name=license_record.holder_name,
            license_type_name=license_record.license_type_name,
            status="revoked",
            message="Cette licence a été révoquée.",
        )

    if now > expires:
        return LicenseVerificationResponse(
            valid=False,
            license_number=license_number,
            holder_name=license_record.holder_name,
            company_name=license_record.company_name,
            vehicle_plate=license_record.vehicle_plate,
            license_type_name=license_record.license_type_name,
            issued_at=license_record.issued_at,
            expires_at=license_record.expires_at,
            status="expired",
            message="Cette licence est expirée.",
        )

    return LicenseVerificationResponse(
        valid=True,
        license_number=license_number,
        holder_name=license_record.holder_name,
        company_name=license_record.company_name,
        vehicle_plate=license_record.vehicle_plate,
        license_type_name=license_record.license_type_name,
        issued_at=license_record.issued_at,
        expires_at=license_record.expires_at,
        status="active",
        message="Licence valide et authentique.",
    )


def hmac_compare(provided: str, expected: str) -> bool:
    import hmac
    return hmac.compare_digest(provided, expected)
