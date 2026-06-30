import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.application import Application
from app.models.issued_license import IssuedLicense
from app.services.license_pdf import generate_license_pdf


def compute_verification_sig(license_number: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(),
        license_number.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]


def build_verify_url(license_number: str, sig: str) -> str:
    return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/v1/verify/{license_number}?sig={sig}"


async def generate_license_number(db: AsyncSession) -> str:
    year = datetime.now(UTC).year
    count = await db.scalar(select(func.count()).select_from(IssuedLicense)) or 0
    return f"LT-GA-{year}-{count + 1:06d}"


async def issue_license_for_application(db: AsyncSession, application_id: int) -> IssuedLicense:
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.applicant),
            selectinload(Application.issued_license),
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one()
    if application.issued_license:
        return application.issued_license

    license_number = await generate_license_number(db)
    sig = compute_verification_sig(license_number)
    validity_months = application.license_type.validity_months
    issued_at = datetime.now(UTC)
    expires_at = issued_at + timedelta(days=validity_months * 30)

    holder_name = application.applicant.full_name
    verify_url = build_verify_url(license_number, sig)

    licenses_dir = Path(settings.LICENSES_DIR) / str(application_id)
    licenses_dir.mkdir(parents=True, exist_ok=True)
    pdf_filename = f"licence_{license_number.replace('-', '_')}.pdf"
    pdf_path = licenses_dir / pdf_filename

    generate_license_pdf(
        output_path=pdf_path,
        license_number=license_number,
        holder_name=holder_name,
        company_name=application.company_name,
        vehicle_plate=application.vehicle_plate,
        license_type_name=application.license_type.name,
        fee_amount=float(application.amount_paid or application.license_type.fee_amount),
        issued_at=issued_at,
        expires_at=expires_at,
        verify_url=verify_url,
        application_reference=application.reference,
    )

    issued = IssuedLicense(
        application_id=application.id,
        license_number=license_number,
        verification_sig=sig,
        holder_name=holder_name,
        company_name=application.company_name,
        vehicle_plate=application.vehicle_plate,
        license_type_name=application.license_type.name,
        pdf_filename=pdf_filename,
        issued_at=issued_at,
        expires_at=expires_at,
    )
    db.add(issued)
    await db.flush()
    return issued


def get_license_pdf_path(application_id: int, pdf_filename: str) -> Path:
    path = Path(settings.LICENSES_DIR) / str(application_id) / pdf_filename
    if not path.exists():
        raise FileNotFoundError(str(path))
    return path
