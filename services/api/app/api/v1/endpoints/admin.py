from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AdminOnlyUser, AdminUser, StaffReadUser, StaffUser, SupervisorUser
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.application import Application, ApplicationStatus, ApplicationStatusHistory
from app.models.audit import AuditLog
from app.models.document import ApplicationDocument
from app.models.license_type import LicenseType
from app.models.user import User, UserRole
from app.schemas.admin_user import (
    CitizenListResponse,
    StaffUserCreate,
    StaffUserResponse,
    StaffUserUpdate,
)
from app.schemas.application import (
    ApplicationAssignUpdate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
    StatusHistoryResponse,
)
from app.schemas.audit import AuditLogResponse
from app.schemas.revenue import RevenueEntryResponse, RevenueSummaryResponse
from app.schemas.dashboard import DashboardStats
from app.services.notifications import notify_awaiting_payment, notify_payment_confirmed, notify_physical_delivered
from app.services.payment import assert_payment_received_for_confirmation, confirm_backoffice_payment
from app.services.revenue import fetch_revenue_entries, fetch_revenue_summary
from app.services.excel_export import (
    build_applications_workbook,
    build_revenue_workbook,
    build_stats_workbook,
)
from app.services.mail import send_license_by_email
from app.services.sms import send_license_delivered_sms
from app.services.storage import get_document_path

router = APIRouter(prefix="/admin", tags=["Administration"])

OVERDUE_DAYS = 7
STAFF_ROLES = (UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN, UserRole.AUDITOR)
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(content: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _history_item(history: ApplicationStatusHistory) -> StatusHistoryResponse:
    return StatusHistoryResponse(
        id=history.id,
        from_status=history.from_status,
        to_status=history.to_status,
        comment=history.comment,
        changed_by_name=history.changed_by.full_name if history.changed_by else None,
        created_at=history.created_at,
    )


def _application_response(application: Application) -> ApplicationResponse:
    base = ApplicationResponse.model_validate(application)
    return base.model_copy(
        update={"status_history": [_history_item(h) for h in application.status_history]}
    )


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(_: StaffUser, db: AsyncSession = Depends(get_db)):
    return await _fetch_dashboard_stats(db)


async def _fetch_dashboard_stats(db: AsyncSession) -> DashboardStats:
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    overdue_threshold = now - timedelta(days=OVERDUE_DAYS)

    total = await db.scalar(select(func.count()).select_from(Application)) or 0
    pending = await db.scalar(
        select(func.count()).select_from(Application).where(
            Application.status.in_([ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW])
        )
    ) or 0
    awaiting_payment = await db.scalar(
        select(func.count()).select_from(Application).where(
            Application.status == ApplicationStatus.AWAITING_PAYMENT
        )
    ) or 0
    delivered = await db.scalar(
        select(func.count()).select_from(Application).where(Application.status == ApplicationStatus.DELIVERED)
    ) or 0
    rejected = await db.scalar(
        select(func.count()).select_from(Application).where(Application.status == ApplicationStatus.REJECTED)
    ) or 0
    citizens = await db.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.CITIZEN)
    ) or 0
    overdue = await db.scalar(
        select(func.count()).select_from(Application).where(
            Application.status.in_([ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW]),
            Application.submitted_at.is_not(None),
            Application.submitted_at < overdue_threshold,
        )
    ) or 0

    total_revenue = float(
        await db.scalar(select(func.coalesce(func.sum(Application.amount_paid), 0))) or 0
    )
    revenue_this_month = float(
        await db.scalar(
            select(func.coalesce(func.sum(Application.amount_paid), 0)).where(
                Application.paid_at.is_not(None),
                Application.paid_at >= month_start,
            )
        )
        or 0
    )

    avg_days_result = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Application.updated_at - Application.submitted_at) / 86400.0
            )
        ).where(
            Application.status == ApplicationStatus.DELIVERED,
            Application.submitted_at.is_not(None),
        )
    )
    avg_processing_days = avg_days_result.scalar()
    avg_processing_days = round(float(avg_processing_days), 1) if avg_processing_days else None

    status_counts: dict[str, int] = {}
    for app_status in ApplicationStatus:
        count = await db.scalar(
            select(func.count()).select_from(Application).where(Application.status == app_status)
        ) or 0
        status_counts[app_status.value] = count

    type_rows = await db.execute(
        select(LicenseType.name, func.count(Application.id))
        .join(Application, Application.license_type_id == LicenseType.id)
        .group_by(LicenseType.name)
    )
    applications_by_license_type = {name: count for name, count in type_rows.all()}

    return DashboardStats(
        total_applications=total,
        pending_review=pending,
        awaiting_payment=awaiting_payment,
        delivered=delivered,
        rejected=rejected,
        total_citizens=citizens,
        total_revenue=total_revenue,
        revenue_this_month=revenue_this_month,
        avg_processing_days=avg_processing_days,
        overdue_count=overdue,
        applications_by_status=status_counts,
        applications_by_license_type=applications_by_license_type,
    )


@router.get("/applications", response_model=list[ApplicationListResponse])
async def list_all_applications(
    user: StaffReadUser,
    db: AsyncSession = Depends(get_db),
    status_filter: ApplicationStatus | None = Query(None, alias="status"),
    license_type_id: int | None = Query(None),
    assigned_agent_id: int | None = Query(None),
    mine: bool = Query(False),
    search: str | None = Query(None, min_length=1),
):
    if user.role == UserRole.AUDITOR and mine:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    query = (
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.applicant),
            selectinload(Application.assigned_agent),
            selectinload(Application.issued_license),
        )
        .order_by(Application.created_at.desc())
    )
    if status_filter:
        query = query.where(Application.status == status_filter)
    if license_type_id:
        query = query.where(Application.license_type_id == license_type_id)
    if mine:
        query = query.where(Application.assigned_agent_id == user.id)
    elif assigned_agent_id:
        query = query.where(Application.assigned_agent_id == assigned_agent_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.join(Application.applicant, isouter=True).where(
            or_(
                Application.reference.ilike(pattern),
                Application.company_name.ilike(pattern),
                Application.vehicle_plate.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
async def get_application_admin(
    application_id: int, _: StaffReadUser, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.status_history).selectinload(ApplicationStatusHistory.changed_by),
            selectinload(Application.applicant),
            selectinload(Application.documents),
            selectinload(Application.issued_license),
            selectinload(Application.assigned_agent),
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")
    return _application_response(application)


@router.get("/applications/{application_id}/documents/{document_id}/download")
async def download_document_admin(
    application_id: int,
    document_id: int,
    _: StaffReadUser,
    db: AsyncSession = Depends(get_db),
):
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


VALID_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.SUBMITTED: {ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED},
    ApplicationStatus.UNDER_REVIEW: {
        ApplicationStatus.COMPLEMENT_REQUESTED,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.COMPLEMENT_REQUESTED: {ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED},
    ApplicationStatus.APPROVED: {ApplicationStatus.PAID},
    ApplicationStatus.AWAITING_PAYMENT: {ApplicationStatus.PAID},
    ApplicationStatus.PAID: {ApplicationStatus.DELIVERED},
}


@router.patch("/applications/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: int,
    data: ApplicationStatusUpdate,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.status_history).selectinload(ApplicationStatusHistory.changed_by),
            selectinload(Application.applicant),
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")

    allowed = VALID_TRANSITIONS.get(application.status, set())
    if data.status not in allowed and application.status != data.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transition {application.status.value} → {data.status.value} non autorisée",
        )

    old_status = application.status

    if data.status == ApplicationStatus.PAID and old_status in {
        ApplicationStatus.AWAITING_PAYMENT,
        ApplicationStatus.APPROVED,
    }:
        await assert_payment_received_for_confirmation(db, application.id)

    application.status = data.status
    if data.status == ApplicationStatus.REJECTED:
        application.rejection_reason = data.rejection_reason or data.comment
    if data.status == ApplicationStatus.UNDER_REVIEW:
        application.assigned_agent_id = admin.id

    if data.status == ApplicationStatus.AWAITING_PAYMENT:
        await notify_awaiting_payment(db, application)

    if data.status == ApplicationStatus.PAID and old_status in {
        ApplicationStatus.AWAITING_PAYMENT,
        ApplicationStatus.APPROVED,
    }:
        await confirm_backoffice_payment(
            db, application, admin.id, comment=data.comment
        )

    if data.status == ApplicationStatus.DELIVERED:
        if application.delivery_format and application.delivery_format.value == "physical":
            await notify_physical_delivered(db, application)
        db.add(
            AuditLog(
                user_id=admin.id,
                action="license_issued",
                resource_type="issued_license",
                resource_id=str(application.id),
            )
        )

    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=old_status,
            to_status=data.status,
            comment=data.comment,
            changed_by_id=admin.id,
        )
    )
    db.add(
        AuditLog(
            user_id=admin.id,
            action="application_status_changed",
            resource_type="application",
            resource_id=str(application.id),
            details=f"{old_status.value} → {data.status.value}",
        )
    )

    await db.flush()

    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.status_history).selectinload(ApplicationStatusHistory.changed_by),
            selectinload(Application.applicant),
            selectinload(Application.documents),
            selectinload(Application.issued_license),
            selectinload(Application.assigned_agent),
        )
        .where(Application.id == application_id)
    )
    return _application_response(result.scalar_one())


@router.post("/applications/{application_id}/resend-license-notifications")
async def resend_license_notifications(
    application_id: int,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """Renvoie l'e-mail (PDF) et le SMS de licence pour un dossier déjà payé."""
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.applicant),
            selectinload(Application.issued_license),
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")
    if application.status not in (ApplicationStatus.PAID, ApplicationStatus.DELIVERED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le dossier doit être payé ou délivré",
        )
    if not application.issued_license:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune licence émise pour ce dossier",
        )

    issued = application.issued_license
    emailed = await send_license_by_email(application, issued)
    smsed = await send_license_delivered_sms(application, issued)
    digital = application.delivery_format and application.delivery_format.value == "digital"
    await notify_payment_confirmed(
        db,
        application,
        digital=digital,
        license_emailed=emailed,
        license_smsed=smsed,
    )

    db.add(
        AuditLog(
            user_id=admin.id,
            action="license_notifications_resent",
            resource_type="application",
            resource_id=str(application.id),
            details=f"e-mail={'oui' if emailed else 'non'}, sms={'oui' if smsed else 'non'}",
        )
    )
    await db.flush()

    return {
        "emailed": emailed,
        "smsed": smsed,
        "message": "Notifications de licence renvoyées",
    }


@router.patch("/applications/{application_id}/assign", response_model=ApplicationResponse)
async def assign_application(
    application_id: int,
    data: ApplicationAssignUpdate,
    supervisor: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.license_type),
            selectinload(Application.status_history).selectinload(ApplicationStatusHistory.changed_by),
            selectinload(Application.applicant),
            selectinload(Application.documents),
            selectinload(Application.issued_license),
            selectinload(Application.assigned_agent),
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable")

    if data.assigned_agent_id is not None:
        agent_result = await db.execute(
            select(User).where(
                User.id == data.assigned_agent_id,
                User.role.in_([UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]),
                User.is_active.is_(True),
            )
        )
        if not agent_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent invalide")

    application.assigned_agent_id = data.assigned_agent_id
    db.add(
        AuditLog(
            user_id=supervisor.id,
            action="application_assigned",
            resource_type="application",
            resource_id=str(application.id),
            details=f"assigned_agent_id={data.assigned_agent_id}",
        )
    )
    await db.flush()
    await db.refresh(application, ["assigned_agent"])
    return _application_response(application)


@router.get("/users", response_model=list[StaffUserResponse])
async def list_staff_users(_: AdminOnlyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.role.in_(STAFF_ROLES)).order_by(User.full_name)
    )
    return result.scalars().all()


@router.get("/citizens", response_model=list[CitizenListResponse])
async def list_citizens(
    _: StaffUser,
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, min_length=1),
):
    apps_count = (
        select(func.count(Application.id))
        .where(Application.applicant_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    query = (
        select(User, apps_count.label("applications_count"))
        .where(User.role == UserRole.CITIZEN)
        .order_by(User.created_at.desc())
    )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.phone.ilike(pattern),
                User.national_id.ilike(pattern),
            )
        )

    result = await db.execute(query)
    rows = result.all()
    return [
        CitizenListResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            national_id=user.national_id,
            is_active=user.is_active,
            created_at=user.created_at,
            applications_count=int(count or 0),
        )
        for user, count in rows
    ]


@router.post("/users", response_model=StaffUserResponse, status_code=status.HTTP_201_CREATED)
async def create_staff_user(data: StaffUserCreate, admin: AdminOnlyUser, db: AsyncSession = Depends(get_db)):
    if data.role == UserRole.CITIZEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rôle invalide")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet email est déjà utilisé")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=data.role,
    )
    db.add(user)
    db.add(
        AuditLog(
            user_id=admin.id,
            action="staff_user_created",
            resource_type="user",
            resource_id=data.email,
            details=f"role={data.role.value}",
        )
    )
    await db.flush()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=StaffUserResponse)
async def update_staff_user(
    user_id: int, data: StaffUserUpdate, admin: AdminOnlyUser, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    if data.role == UserRole.CITIZEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rôle invalide")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.add(
        AuditLog(
            user_id=admin.id,
            action="staff_user_updated",
            resource_type="user",
            resource_id=str(user.id),
        )
    )
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    _: StaffUser,
    db: AsyncSession = Depends(get_db),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    user_id: int | None = Query(None),
    limit: int = Query(100, le=500),
):
    query = (
        select(AuditLog, User.full_name, User.email)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)

    rows = await db.execute(query)
    return [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=full_name,
            user_email=email,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log, full_name, email in rows.all()
    ]


@router.get("/revenue/summary", response_model=RevenueSummaryResponse)
async def get_revenue_summary(_: StaffUser, db: AsyncSession = Depends(get_db)):
    return await fetch_revenue_summary(db)


@router.get("/revenue/entries", response_model=list[RevenueEntryResponse])
async def list_revenue_entries(
    _: StaffUser,
    db: AsyncSession = Depends(get_db),
    state: str | None = Query(None, pattern="^(confirmed|pending_validation)$"),
):
    return await fetch_revenue_entries(db, state=state)


@router.get("/export/revenue")
async def export_revenue_xlsx(
    _: StaffUser,
    db: AsyncSession = Depends(get_db),
    state: str | None = Query(None, pattern="^(confirmed|pending_validation)$"),
):
    summary = await fetch_revenue_summary(db)
    entries = await fetch_revenue_entries(db, state=state)
    content = build_revenue_workbook(summary, entries)
    filename = f"recettes_{datetime.now(UTC).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(content, filename)


@router.get("/export/applications")
async def export_applications_xlsx(
    _: StaffUser,
    db: AsyncSession = Depends(get_db),
    status_filter: ApplicationStatus | None = Query(None, alias="status"),
):
    query = (
        select(Application)
        .options(selectinload(Application.license_type), selectinload(Application.applicant))
        .order_by(Application.created_at.desc())
    )
    if status_filter:
        query = query.where(Application.status == status_filter)

    result = await db.execute(query)
    applications = result.scalars().all()
    content = build_applications_workbook(applications)
    filename = f"dossiers_{datetime.now(UTC).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(content, filename)


@router.get("/export/stats")
async def export_stats_xlsx(_: StaffUser, db: AsyncSession = Depends(get_db)):
    stats = await _fetch_dashboard_stats(db)
    content = build_stats_workbook(stats)
    filename = f"statistiques_{datetime.now(UTC).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(content, filename)
