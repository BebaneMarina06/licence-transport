from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.application import Application, ApplicationStatus
from app.models.audit import AuditLog
from app.models.document import (
    DOCUMENT_LABELS,
    REQUIRED_DOCUMENT_TYPES,
    ApplicationDocument,
    DocumentType,
)
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services.storage import get_document_path, save_upload_file
from app.services.platform_settings import is_ocr_enabled
from app.services.document_ocr import process_document_ocr

router = APIRouter(prefix="/applications", tags=["Documents"])


async def _get_owned_application(
    db: AsyncSession, application_id: int, user_id: int
) -> Application:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id, Application.applicant_id == user_id
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")
    return application


@router.get("/{application_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    application_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    await _get_owned_application(db, application_id, current_user.id)
    result = await db.execute(
        select(ApplicationDocument)
        .where(ApplicationDocument.application_id == application_id)
        .order_by(ApplicationDocument.uploaded_at)
    )
    return result.scalars().all()


@router.post(
    "/{application_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    application_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
):
    application = await _get_owned_application(db, application_id, current_user.id)
    editable_statuses = {ApplicationStatus.DRAFT, ApplicationStatus.COMPLEMENT_REQUESTED}
    if application.status not in editable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les documents ne peuvent être modifiés que pour un dossier en brouillon ou en attente de complément",
        )

    existing = await db.execute(
        select(ApplicationDocument).where(
            ApplicationDocument.application_id == application_id,
            ApplicationDocument.document_type == document_type,
        )
    )
    old_doc = existing.scalar_one_or_none()
    if old_doc:
        try:
            get_document_path(application_id, old_doc.stored_filename).unlink(missing_ok=True)
        except HTTPException:
            pass
        await db.delete(old_doc)
        await db.flush()

    original_filename, stored_filename, file_size = await save_upload_file(
        file, application_id, document_type.value
    )

    doc = ApplicationDocument(
        application_id=application_id,
        document_type=document_type,
        original_filename=original_filename,
        stored_filename=stored_filename,
        content_type=file.content_type or "application/octet-stream",
        file_size=file_size,
    )
    db.add(doc)
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="document_uploaded",
            resource_type="application_document",
            resource_id=str(application_id),
            details=f"{document_type.value}: {original_filename}",
        )
    )
    await db.flush()

    ocr_enabled = await is_ocr_enabled(db)
    ocr_applied: list[str] = []
    ocr_fields: dict = {}
    ocr_message: str | None = None

    if ocr_enabled:
        file_path = get_document_path(application_id, stored_filename)
        try:
            ocr_result = await process_document_ocr(db, application, doc, file_path)
            ocr_fields = ocr_result.get("fields") or {}
            ocr_applied = ocr_result.get("applied") or []
            if ocr_fields:
                ocr_message = "Lecture automatique effectuée — vérifiez les champs pré-remplis."
            else:
                ocr_message = (
                    "Lecture automatique activée : aucune donnée exploitable détectée sur ce document."
                )
        except Exception:
            ocr_message = "Lecture automatique en échec — saisissez les informations manuellement."

    return DocumentUploadResponse(
        document=DocumentResponse.model_validate(doc),
        ocr_enabled=ocr_enabled,
        ocr_applied=ocr_applied,
        ocr_fields=ocr_fields,
        ocr_message=ocr_message,
    )


@router.delete("/{application_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    application_id: int,
    document_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    application = await _get_owned_application(db, application_id, current_user.id)
    editable_statuses = {ApplicationStatus.DRAFT, ApplicationStatus.COMPLEMENT_REQUESTED}
    if application.status not in editable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les documents ne peuvent être supprimés que pour un dossier modifiable",
        )

    result = await db.execute(
        select(ApplicationDocument).where(
            ApplicationDocument.id == document_id,
            ApplicationDocument.application_id == application_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable")

    try:
        get_document_path(application_id, doc.stored_filename).unlink(missing_ok=True)
    except HTTPException:
        pass
    await db.delete(doc)


@router.get("/{application_id}/documents/{document_id}/download")
async def download_document_citizen(
    application_id: int,
    document_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_application(db, application_id, current_user.id)
    result = await db.execute(
        select(ApplicationDocument).where(
            ApplicationDocument.id == document_id,
            ApplicationDocument.application_id == application_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable")

    file_path = get_document_path(application_id, doc.stored_filename)
    return FileResponse(file_path, filename=doc.original_filename, media_type=doc.content_type)


def get_missing_documents(documents: list[ApplicationDocument]) -> list[str]:
    uploaded = {doc.document_type for doc in documents}
    missing = [dt for dt in REQUIRED_DOCUMENT_TYPES if dt not in uploaded]
    return [DOCUMENT_LABELS[dt] for dt in missing]
