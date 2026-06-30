from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.application import ApplicationStatus
from app.models.user import User, UserRole
from app.services.staff import is_staff, staff_profile_complete


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    national_id: str | None = None

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Les mots de passe ne correspondent pas")
        return self


class UserLogin(BaseModel):
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    password: str

    @model_validator(mode="after")
    def require_identifier(self):
        if not self.email and not self.phone:
            raise ValueError("L'email ou le numéro de téléphone est requis")
        return self


class UserProfileUpdate(BaseModel):
    email: EmailStr | None = None
    phone: str | None = Field(None, min_length=8, max_length=20)

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if self.email is None and self.phone is None:
            raise ValueError("Au moins l'e-mail ou le téléphone doit être renseigné")
        return self


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    national_id: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    profile_complete: bool = True

    model_config = {"from_attributes": True}


def user_to_response(user: User) -> UserResponse:
    response = UserResponse.model_validate(user)
    if is_staff(user):
        return response.model_copy(update={"profile_complete": staff_profile_complete(user)})
    return response


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str
