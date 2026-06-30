from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.api.v1.endpoints.payments import bamboo_webhook
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.db.upgrade import upgrade_schema
from app.models import *  # noqa: F401, F403
from app.seed import seed_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await upgrade_schema(conn)
    await seed_database()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="API de digitalisation des licences de transport - République Gabonaise",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Error-Technical"],
)


@app.exception_handler(HTTPException)
async def http_exception_with_technical(request: Request, exc: HTTPException):
    """Expose le détail technique BambooPay en champ séparé (console dev, pas l'écran)."""
    if isinstance(exc.detail, dict) and exc.detail.get("technical"):
        technical = str(exc.detail["technical"])
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail.get("message") or "Une erreur est survenue",
                "technical": technical,
            },
            headers={"X-Error-Technical": technical[:500]},
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Alias webhook Bamboo (chemin test / sms-manager : /api/payments/webhook/bamboo)
app.add_api_route(
    "/api/payments/webhook/bamboo",
    bamboo_webhook,
    methods=["POST"],
    tags=["Paiements"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
