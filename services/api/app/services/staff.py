from app.models.user import User, UserRole

STAFF_ROLES = frozenset(
    {UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN, UserRole.AUDITOR}
)
STAFF_NOTIFY_NEW_APPLICATION_ROLES = frozenset(
    {UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN}
)


def is_staff(user: User) -> bool:
    return user.role in STAFF_ROLES


def staff_profile_complete(user: User) -> bool:
    if not is_staff(user):
        return True
    email = (user.email or "").strip()
    phone = (user.phone or "").strip()
    return bool(email and phone)
