from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_setting import PlatformSetting

OCR_ENABLED_KEY = "ocr.enabled"


async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))
    row = result.scalar_one_or_none()
    if not row:
        return default
    return row.value


async def get_bool_setting(db: AsyncSession, key: str, *, default: bool = False) -> bool:
    raw = await get_setting(db, key, default="true" if default else "false")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def set_setting(
    db: AsyncSession,
    key: str,
    value: str,
    *,
    description: str | None = None,
) -> PlatformSetting:
    result = await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
        if description is not None:
            row.description = description
    else:
        row = PlatformSetting(key=key, value=value, description=description)
        db.add(row)
    await db.flush()
    return row


async def is_ocr_enabled(db: AsyncSession) -> bool:
    return await get_bool_setting(db, OCR_ENABLED_KEY, default=False)
