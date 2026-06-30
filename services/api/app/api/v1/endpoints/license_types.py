from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.license_type import LicenseType
from app.schemas.license_type import LicenseTypeResponse

router = APIRouter(prefix="/license-types", tags=["Types de licence"])


@router.get("", response_model=list[LicenseTypeResponse])
async def list_license_types(
    response: Response,
    db: AsyncSession = Depends(get_db),
    lang: str = Query("fr", pattern="^(fr|en)$"),
):
    response.headers["Cache-Control"] = "no-store"
    result = await db.execute(
        select(LicenseType).where(LicenseType.is_active.is_(True)).order_by(LicenseType.name)
    )
    types = result.scalars().all()
    if lang == "en":
        return [
            LicenseTypeResponse.model_validate(lt).model_copy(
                update={
                    "name": lt.name_en or lt.name,
                    "description": lt.description_en or lt.description,
                }
            )
            for lt in types
        ]
    return types
