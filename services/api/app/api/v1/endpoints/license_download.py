from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser
from app.db.session import get_db
from app.models.application import Application, ApplicationStatus
from app.models.issued_license import IssuedLicense
from app.services.license_issue import get_license_pdf_path

router = APIRouter(tags=["Licence PDF"])


@router.get("/applications/{application_id}/license/download")
async def download_license_citizen(
    application_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    app_result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.applicant_id == current_user.id,
        )
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")
    if application.status not in (ApplicationStatus.PAID, ApplicationStatus.DELIVERED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Licence disponible après validation du paiement par la DGTT",
        )

    lic_result = await db.execute(
        select(IssuedLicense).where(IssuedLicense.application_id == application_id)
    )
    issued = lic_result.scalar_one_or_none()
    if not issued:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licence non encore délivrée")

    try:
        pdf_path = get_license_pdf_path(application_id, issued.pdf_filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier PDF introuvable") from exc

    return FileResponse(
        pdf_path,
        filename=f"{issued.license_number}.pdf",
        media_type="application/pdf",
    )


@router.get("/admin/applications/{application_id}/license/download")
async def download_license_admin(
    application_id: int,
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IssuedLicense).where(IssuedLicense.application_id == application_id)
    )
    issued = result.scalar_one_or_none()
    if not issued:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licence introuvable")

    try:
        pdf_path = get_license_pdf_path(application_id, issued.pdf_filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier PDF introuvable") from exc

    return FileResponse(
        pdf_path,
        filename=f"{issued.license_number}.pdf",
        media_type="application/pdf",
    )
