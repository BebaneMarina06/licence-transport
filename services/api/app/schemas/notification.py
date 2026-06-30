from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    application_id: int | None
    title: str
    message: str
    link: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
