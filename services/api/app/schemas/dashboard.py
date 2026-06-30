from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_applications: int
    pending_review: int
    awaiting_payment: int
    delivered: int
    rejected: int
    total_citizens: int
    total_revenue: float
    revenue_this_month: float
    avg_processing_days: float | None
    overdue_count: int
    applications_by_status: dict[str, int]
    applications_by_license_type: dict[str, int]
