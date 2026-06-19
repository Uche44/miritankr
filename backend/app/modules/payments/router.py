from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user, RoleChecker
from app.modules.payments.schemas import (
    PaymentInitializeRequest,
    PaymentInitializeResponse,
    PaymentInitializeEnvelope,
    PaymentVerifyResponse,
    PaymentVerifyEnvelope,
    BankListEnvelope,
    ResolveAccountEnvelope
)
from app.modules.payments.service import payment_service

router = APIRouter()

@router.post(
    "/payments/initialize", 
    response_model=PaymentInitializeEnvelope, 
    status_code=status.HTTP_200_OK, 
    tags=["Payments"]
)
async def initialize_payment(
    payload: PaymentInitializeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["CUSTOMER", "ADMIN"]))
):
    """
    Initialize a Paystack payment checkout session for an order.
    Returns a checkout URL and unique transaction reference.
    Allowed roles: CUSTOMER, ADMIN.
    """
    checkout_url, reference, public_key = await payment_service.initialize_payment(db, payload.order_id, current_user)
    return PaymentInitializeEnvelope(
        success=True,
        message="Payment initialized successfully",
        data=PaymentInitializeResponse(checkout_url=checkout_url, reference=reference, public_key=public_key)
    )

@router.get(
    "/payments/verify/{reference}", 
    response_model=PaymentVerifyEnvelope, 
    tags=["Payments"]
)
async def verify_payment(
    reference: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify the payment details and status for a transaction reference.
    Allowed roles: Any authenticated user associated with the target order (customer, driver, admin).
    """
    payment = await payment_service.verify_payment(db, reference, current_user)
    return PaymentVerifyEnvelope(
        success=True,
        message="Payment details retrieved successfully",
        data=PaymentVerifyResponse.from_orm(payment)
    )

@router.post(
    "/payments/webhook", 
    status_code=status.HTTP_200_OK, 
    tags=["Payments"]
)
async def process_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Paystack webhook callback listener.
    Simulates gateway notifications updating the corresponding transaction status.
    Public endpoint.
    """
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")
    await payment_service.process_webhook(
        db=db,
        raw_body=raw_body,
        signature=signature
    )
    return {"status": "success", "message": "Webhook processed successfully"}

@router.get(
    "/payments/banks",
    response_model=BankListEnvelope,
    tags=["Payments"]
)
async def list_banks(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve list of banks from Paystack.
    """
    banks = await payment_service.list_banks()
    return BankListEnvelope(
        success=True,
        message="Banks list retrieved successfully",
        data=banks
    )

@router.get(
    "/payments/resolve-account",
    response_model=ResolveAccountEnvelope,
    tags=["Payments"]
)
async def resolve_account(
    account_number: str,
    bank_code: str,
    current_user: User = Depends(get_current_user)
):
    """
    Verify bank account details using bank code and account number.
    """
    resolved = await payment_service.resolve_account(account_number, bank_code)
    return ResolveAccountEnvelope(
        success=True,
        message="Account details resolved successfully",
        data=resolved
    )
