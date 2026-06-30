from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    applications,
    auth,
    documents,
    license_download,
    license_types,
    licenses,
    notifications,
    payments,
    referentials,
    verify,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(license_types.router)
api_router.include_router(applications.router)
api_router.include_router(documents.router)
api_router.include_router(payments.router)
api_router.include_router(license_download.router)
api_router.include_router(licenses.router)
api_router.include_router(notifications.router)
api_router.include_router(verify.router)
api_router.include_router(admin.router)
api_router.include_router(referentials.router)
api_router.include_router(referentials.labels_router)
