from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminOnlyUser, SupervisorUser
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.license_type import LicenseType
from app.models.platform_label import PlatformLabel
from app.schemas.license_type import LicenseTypeCreate, LicenseTypeResponse, LicenseTypeUpdate
from app.schemas.platform_label import (
    LabelsDictionary,
    PlatformLabelCreate,
    PlatformLabelResponse,
    PlatformLabelUpdate,
)
from app.schemas.platform_setting import OcrSettingsResponse, OcrSettingsUpdate
from app.services.platform_settings import OCR_ENABLED_KEY, is_ocr_enabled, set_setting

router = APIRouter(prefix="/admin/referentials", tags=["Référentiels"])


@router.get("/license-types", response_model=list[LicenseTypeResponse])
async def list_all_license_types(_: SupervisorUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LicenseType).order_by(LicenseType.code))
    return result.scalars().all()


@router.post("/license-types", response_model=LicenseTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_license_type(
    data: LicenseTypeCreate, admin: SupervisorUser, db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(LicenseType).where(LicenseType.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce code existe déjà")

    license_type = LicenseType(**data.model_dump())
    db.add(license_type)
    db.add(
        AuditLog(
            user_id=admin.id,
            action="license_type_created",
            resource_type="license_type",
            resource_id=data.code,
        )
    )
    await db.flush()
    await db.refresh(license_type)
    return license_type


@router.patch("/license-types/{type_id}", response_model=LicenseTypeResponse)
async def update_license_type(
    type_id: int,
    data: LicenseTypeUpdate,
    admin: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LicenseType).where(LicenseType.id == type_id))
    license_type = result.scalar_one_or_none()
    if not license_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type introuvable")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(license_type, field, value)

    db.add(
        AuditLog(
            user_id=admin.id,
            action="license_type_updated",
            resource_type="license_type",
            resource_id=license_type.code,
        )
    )
    await db.flush()
    await db.refresh(license_type)
    return license_type


@router.get("/labels", response_model=list[PlatformLabelResponse])
async def list_platform_labels(_: AdminOnlyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformLabel).order_by(PlatformLabel.category, PlatformLabel.key))
    return result.scalars().all()


@router.post("/labels", response_model=PlatformLabelResponse, status_code=status.HTTP_201_CREATED)
async def create_platform_label(
    data: PlatformLabelCreate, admin: AdminOnlyUser, db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(PlatformLabel).where(PlatformLabel.key == data.key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette clé existe déjà")

    label = PlatformLabel(**data.model_dump())
    db.add(label)
    db.add(
        AuditLog(
            user_id=admin.id,
            action="platform_label_created",
            resource_type="platform_label",
            resource_id=data.key,
        )
    )
    await db.flush()
    await db.refresh(label)
    return label


@router.patch("/labels/{label_id}", response_model=PlatformLabelResponse)
async def update_platform_label(
    label_id: int,
    data: PlatformLabelUpdate,
    admin: AdminOnlyUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlatformLabel).where(PlatformLabel.id == label_id))
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Libellé introuvable")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(label, field, value)

    db.add(
        AuditLog(
            user_id=admin.id,
            action="platform_label_updated",
            resource_type="platform_label",
            resource_id=label.key,
        )
    )
    await db.flush()
    await db.refresh(label)
    return label


@router.get("/settings/ocr", response_model=OcrSettingsResponse)
async def get_ocr_settings(_: AdminOnlyUser, db: AsyncSession = Depends(get_db)):
    return OcrSettingsResponse(enabled=await is_ocr_enabled(db))


@router.patch("/settings/ocr", response_model=OcrSettingsResponse)
async def update_ocr_settings(
    data: OcrSettingsUpdate,
    admin: AdminOnlyUser,
    db: AsyncSession = Depends(get_db),
):
    await set_setting(
        db,
        OCR_ENABLED_KEY,
        "true" if data.enabled else "false",
        description="Lecture automatique OCR des pièces justificatives",
    )
    db.add(
        AuditLog(
            user_id=admin.id,
            action="ocr_setting_updated",
            resource_type="platform_setting",
            resource_id=OCR_ENABLED_KEY,
            details=f"ocr.enabled={'true' if data.enabled else 'false'}",
        )
    )
    await db.flush()
    return OcrSettingsResponse(enabled=data.enabled)


labels_router = APIRouter(prefix="/labels", tags=["Libellés"])


@labels_router.get("", response_model=LabelsDictionary)
async def get_public_labels(
    lang: str = Query("fr", pattern="^(fr|en)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlatformLabel))
    labels = result.scalars().all()
    dictionary = {
        label.key: label.label_en if lang == "en" else label.label_fr for label in labels
    }
    return LabelsDictionary(lang=lang, labels=dictionary)
