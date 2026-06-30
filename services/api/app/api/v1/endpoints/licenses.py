from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.application import Application, ApplicationStatus
from app.models.issued_license import IssuedLicense
from app.schemas.issued_license import IssuedLicenseResponse

router = APIRouter(prefix="/licenses", tags=["Licences"])


class CitizenLicenseResponse(IssuedLicenseResponse):
    application_id: int
    application_reference: str
    delivery_format: str | None


@router.get("/mine", response_model=list[CitizenLicenseResponse])
async def list_my_licenses(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IssuedLicense)
        .join(Application, IssuedLicense.application_id == Application.id)
        .options(selectinload(IssuedLicense.application).selectinload(Application.license_type))
        .where(
            Application.applicant_id == current_user.id,
            IssuedLicense.is_revoked.is_(False),
            Application.status.in_((ApplicationStatus.PAID, ApplicationStatus.DELIVERED)),
        )
        .order_by(IssuedLicense.issued_at.desc())
    )
    licenses = result.scalars().all()

    return [
        CitizenLicenseResponse(
            id=lic.id,
            license_number=lic.license_number,
            holder_name=lic.holder_name,
            company_name=lic.company_name,
            vehicle_plate=lic.vehicle_plate,
            license_type_name=lic.license_type_name,
            issued_at=lic.issued_at,
            expires_at=lic.expires_at,
            is_revoked=lic.is_revoked,
            application_id=lic.application_id,
            application_reference=lic.application.reference,
            delivery_format=(
                lic.application.delivery_format.value if lic.application.delivery_format else None
            ),
        )
        for lic in licenses
    ]
