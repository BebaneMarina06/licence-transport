from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, CurrentUser
from app.api.v1.endpoints.documents import get_missing_documents
from app.db.session import get_db
from app.models.application import Application, ApplicationStatus, ApplicationStatusHistory
from app.models.audit import AuditLog
from app.models.license_type import LicenseType
from app.schemas.application import (
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
    ApplicationUpdate,
)
from app.services.notifications import notify_payment_required_for_submission

router = APIRouter(prefix="/applications", tags=["Dossiers"])

LICENSE_VISIBLE_TO_CITIZEN = {ApplicationStatus.PAID, ApplicationStatus.DELIVERED}


def to_citizen_application_response(application: Application) -> ApplicationResponse:
    response = ApplicationResponse.model_validate(application)
    if application.status not in LICENSE_VISIBLE_TO_CITIZEN:
        response.issued_license = None
    return response


def to_citizen_application_list_response(application: Application) -> ApplicationListResponse:
    response = ApplicationListResponse.model_validate(application)
    if application.status not in LICENSE_VISIBLE_TO_CITIZEN:
        response.issued_license = None
    return response


def generate_reference() -> str:
    now = datetime.now(UTC)
    return f"LT-{now.strftime('%Y%m')}-{now.strftime('%H%M%S%f')[:8].upper()}"


async def _get_application_or_404(
    db: AsyncSession, application_id: int, applicant_id: int | None = None
) -> Application:
    query = (
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.status_history),
            selectinload(Application.applicant),
            selectinload(Application.assigned_agent),
            selectinload(Application.documents),
            selectinload(Application.issued_license),
        )
        .where(Application.id == application_id)
    )
    if applicant_id is not None:
        query = query.where(Application.applicant_id == applicant_id)

    result = await db.execute(query)
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")
    return application


@router.get("/mine", response_model=list[ApplicationListResponse])
async def list_my_applications(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.applicant),
            selectinload(Application.assigned_agent),
            selectinload(Application.issued_license),
        )
        .where(Application.applicant_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return [to_citizen_application_list_response(app) for app in result.scalars().all()]


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    data: ApplicationCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    lt_result = await db.execute(
        select(LicenseType).where(LicenseType.id == data.license_type_id, LicenseType.is_active.is_(True))
    )
    if not lt_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type de licence introuvable")

    application = Application(
        reference=generate_reference(),
        applicant_id=current_user.id,
        license_type_id=data.license_type_id,
        company_name=data.company_name,
        vehicle_plate=data.vehicle_plate,
        notes=data.notes,
        status=ApplicationStatus.DRAFT,
    )
    db.add(application)
    await db.flush()

    history = ApplicationStatusHistory(
        application_id=application.id,
        from_status=None,
        to_status=ApplicationStatus.DRAFT,
        comment="Dossier créé",
        changed_by_id=current_user.id,
    )
    db.add(history)
    await db.flush()

    return to_citizen_application_response(
        await _get_application_or_404(db, application.id, current_user.id)
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    return to_citizen_application_response(
        await _get_application_or_404(db, application_id, current_user.id)
    )


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: int,
    data: ApplicationUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    application = await _get_application_or_404(db, application_id, current_user.id)
    editable_statuses = {ApplicationStatus.DRAFT, ApplicationStatus.COMPLEMENT_REQUESTED}
    if application.status not in editable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce dossier ne peut plus être modifié",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(application, field, value)

    await db.flush()

    return to_citizen_application_response(
        await _get_application_or_404(db, application_id, current_user.id)
    )


@router.post("/{application_id}/submit", response_model=ApplicationResponse)
async def submit_application(
    application_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    application = await _get_application_or_404(db, application_id, current_user.id)
    if application.status != ApplicationStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dossier déjà soumis")

    missing = get_missing_documents(list(application.documents))
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Documents manquants : {', '.join(missing)}",
        )

    old_status = application.status
    application.status = ApplicationStatus.AWAITING_PAYMENT

    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=old_status,
            to_status=ApplicationStatus.AWAITING_PAYMENT,
            comment="Paiement requis pour finaliser la demande",
            changed_by_id=current_user.id,
        )
    )
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="application_pending_payment",
            resource_type="application",
            resource_id=str(application.id),
        )
    )

    await notify_payment_required_for_submission(db, application)
    await db.flush()

    return to_citizen_application_response(
        await _get_application_or_404(db, application_id, current_user.id)
    )


@router.post("/{application_id}/resubmit", response_model=ApplicationResponse)
async def resubmit_application(
    application_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    application = await _get_application_or_404(db, application_id, current_user.id)
    if application.status != ApplicationStatus.COMPLEMENT_REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seuls les dossiers en attente de complément peuvent être resoumis",
        )

    missing = get_missing_documents(list(application.documents))
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Documents manquants : {', '.join(missing)}",
        )

    old_status = application.status
    application.status = ApplicationStatus.UNDER_REVIEW

    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=old_status,
            to_status=ApplicationStatus.UNDER_REVIEW,
            comment="Compléments fournis — dossier resoumis",
            changed_by_id=current_user.id,
        )
    )
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="application_resubmitted",
            resource_type="application",
            resource_id=str(application.id),
        )
    )

    await notify_staff_new_application(db, application, resubmit=True)
    await db.flush()

    return to_citizen_application_response(
        await _get_application_or_404(db, application_id, current_user.id)
    )
