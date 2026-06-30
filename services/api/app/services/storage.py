import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings


def ensure_upload_dir() -> Path:
    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


def validate_upload(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nom de fichier manquant")

    extension = Path(file.filename).suffix.lstrip(".").lower()
    if extension not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format non autorisé. Formats acceptés : {', '.join(settings.allowed_extensions)}",
        )
    return extension


async def save_upload_file(file: UploadFile, application_id: int, document_type: str) -> tuple[str, str, int]:
    extension = validate_upload(file)
    content = await file.read()
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux (max {settings.MAX_UPLOAD_SIZE_MB} Mo)",
        )

    upload_dir = ensure_upload_dir() / str(application_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{document_type}_{uuid.uuid4().hex}.{extension}"
    file_path = upload_dir / stored_filename
    file_path.write_bytes(content)

    return file.filename, stored_filename, len(content)


def get_document_path(application_id: int, stored_filename: str) -> Path:
    file_path = Path(settings.UPLOAD_DIR) / str(application_id) / stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable")
    return file_path
