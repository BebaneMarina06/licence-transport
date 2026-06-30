from pydantic import BaseModel, Field

from app.models.application import DeliveryFormat


class PaymentRequest(BaseModel):
    delivery_format: DeliveryFormat
    phone: str = Field(..., min_length=8, description="Numéro Mobile Money")
    operator: str = Field(..., description="airtel | moov | orange")


class PaymentQuoteResponse(BaseModel):
    delivery_format: DeliveryFormat
    base_fee: float
    physical_surcharge: float
    total_amount: float


class PaymentResponse(BaseModel):
    application_id: int
    reference: str
    delivery_format: DeliveryFormat
    amount_paid: float | None = None
    status: str
    payment_reference: str
    payment_status: str
    billing_id: str
    bamboo_ref: str | None = None
    message: str


class PaymentStatusResponse(BaseModel):
    billing_id: str
    payment_status: str
    bamboo_ref: str | None = None
    application_status: str
    message: str


class BambooWebhookPayload(BaseModel):
    billingId: str | None = None
    billing_id: str | None = None
    status: str | None = None
    ref: str | None = None
    typePaiement: str | None = None
    type_paiement: str | None = None
    numCpte: str | None = None
    observation: str | None = None
