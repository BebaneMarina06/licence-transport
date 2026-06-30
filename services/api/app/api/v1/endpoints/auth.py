from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.services.staff import is_staff
from app.schemas.auth import (
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserProfileUpdate,
    UserResponse,
    user_to_response,
)

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet email est déjà utilisé")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        national_id=data.national_id,
        role=UserRole.CITIZEN,
    )
    db.add(user)
    await db.flush()

    db.add(
        AuditLog(
            user_id=user.id,
            action="user_registered",
            resource_type="user",
            resource_id=str(user.id),
        )
    )

    return user_to_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = None
    email = data.email.strip().lower() if data.email else None
    phone = data.phone.strip() if data.phone else None

    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if not user and phone:
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

    if user and email and phone and user.phone and user.phone != phone:
        user = None

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé")

    return TokenResponse(
        access_token=create_access_token(str(user.id), {"role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
        user=user_to_response(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
        user_id = int(payload["sub"])
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide") from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")

    return TokenResponse(
        access_token=create_access_token(str(user.id), {"role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
        user=user_to_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserProfileUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if not is_staff(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les agents DGTT peuvent modifier ce profil",
        )

    if data.email is not None:
        email = data.email.strip().lower()
        existing = await db.execute(
            select(User).where(User.email == email, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet e-mail est déjà utilisé")
        current_user.email = email

    if data.phone is not None:
        current_user.phone = data.phone.strip()

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="staff_profile_updated",
            resource_type="user",
            resource_id=str(current_user.id),
        )
    )
    await db.flush()
    return user_to_response(current_user)
