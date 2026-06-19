import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.modules.water_sources.schemas import BaseEnvelope

class PaymentInitializeRequest(BaseModel):
    order_id: uuid.UUID = Field(..., description="Order ID to initialize payment for")

class PaymentInitializeResponse(BaseModel):
    checkout_url: str = Field(..., description="Paystack checkout/authorization url")
    reference: str = Field(..., description="Unique payment transaction reference")
    public_key: str = Field(..., description="Paystack public key for frontend inline checkout")

class PaymentInitializeEnvelope(BaseEnvelope):
    data: PaymentInitializeResponse

class BankItem(BaseModel):
    name: str
    code: str

class BankListEnvelope(BaseEnvelope):
    data: list[BankItem]

class ResolvedAccount(BaseModel):
    account_number: str
    account_name: str
    bank_id: int

class ResolveAccountEnvelope(BaseEnvelope):
    data: ResolvedAccount

class PaymentVerifyResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    reference: str
    amount: float
    status: str
    provider: str
    timestamp: datetime

    class Config:
        from_attributes = True

class PaymentVerifyEnvelope(BaseEnvelope):
    data: PaymentVerifyResponse

class WebhookData(BaseModel):
    reference: str
    status: str
    amount: Optional[float] = None

class PaymentWebhookRequest(BaseModel):
    event: str = Field(..., description="Paystack event type, e.g. charge.success")
    data: WebhookData
