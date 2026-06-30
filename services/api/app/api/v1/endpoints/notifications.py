from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/mine", response_model=list[NotificationResponse])
async def list_my_notifications(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/unread-count")
async def unread_count(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
    )
    return {"count": len(result.scalars().all())}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
    notification.is_read = True
    return notification


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
