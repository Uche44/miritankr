import uuid
import httpx
import hmac
import hashlib
import json
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.modules.payments.models import Payment
from app.modules.payments.repository import payment_repo
from app.modules.orders.models import Order
from app.modules.auth.models import User

class PaymentService:
    async def initialize_payment(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        current_user: User
    ) -> tuple[str, str, str]:
        # 1. Fetch order
        order_result = await db.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.customer))
        )
        order = order_result.scalars().first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found."
            )

        # Access check: only placing customer or admin can initialize payment
        if current_user.id != order.customer_id and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only the customer who placed the order can initialize payment."
            )

        # Enforce Pay-After-Service: Order must be DELIVERED to initialize payment
        if order.status != "DELIVERED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment can only be processed after the service has been successfully DELIVERED."
            )

        # 2. Check if payment already exists
        payment = await payment_repo.get_by_order_id(db, order_id)
        if payment:
            if payment.status == "SUCCESSFUL":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This order has already been paid successfully."
                )
            # Reuse existing pending reference
            reference = payment.reference
        else:
            # Generate a unique reference
            reference = f"pay_{uuid.uuid4().hex}"
            payment = await payment_repo.create(
                db=db,
                order_id=order_id,
                amount=float(order.price),
                reference=reference,
                provider="Paystack"
            )
            await db.commit()

        amount_kobo = int(float(order.price) * 100)
        email = order.customer.email or "customer@example.com"

        # If secret key is empty, fall back to mock checkout URL
        if not settings.PAYSTACK_SECRET_KEY:
            checkout_url = f"https://checkout.paystack.com/mock/{reference}"
            return checkout_url, reference, settings.PAYSTACK_PUBLIC_KEY or "pk_test_d3a3c2ce526017b2b7e5f32b8509c2a381cd3d99"

        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "email": email,
            "amount": amount_kobo,
            "reference": reference,
            "metadata": {"order_id": str(order_id)}
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Failed to initialize payment with Paystack: {response.text}"
                    )
                resp_data = response.json()
                if not resp_data.get("status"):
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Paystack initialization error: {resp_data.get('message')}"
                    )
                
                checkout_url = resp_data["data"]["authorization_url"]
                return checkout_url, reference, settings.PAYSTACK_PUBLIC_KEY
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Network error contacting Paystack: {str(exc)}"
                )

    async def verify_payment_with_paystack(self, reference: str) -> dict:
        """
        Verify transaction status using Paystack API.
        """
        if not settings.PAYSTACK_SECRET_KEY:
            # Mock verification for dev/testing when no key is provided
            return {"status": "pending", "amount": 0}

        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://api.paystack.co/transaction/verify/{reference}",
                    headers=headers,
                    timeout=10.0
                )
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Failed to verify payment with Paystack: {response.text}"
                    )
                resp_data = response.json()
                if not resp_data.get("status"):
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Paystack verification error: {resp_data.get('message')}"
                    )
                return resp_data["data"]
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Network error verifying with Paystack: {str(exc)}"
                )

    async def verify_payment(
        self,
        db: AsyncSession,
        reference: str,
        current_user: User
    ) -> Payment:
        payment = await payment_repo.get_by_reference(db, reference)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found."
            )
        
        # Access check
        order_result = await db.execute(
            select(Order).where(Order.id == payment.order_id)
        )
        order = order_result.scalars().first()
        if order:
            is_authorized = (
                current_user.id == order.customer_id 
                or current_user.role == "ADMIN" 
                or current_user.id == order.assigned_driver_id
            )
            if not is_authorized:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You are not authorized to view this payment."
                )

        # If it is still pending in DB, verify with Paystack to see if status changed
        if payment.status == "PENDING":
            paystack_data = await self.verify_payment_with_paystack(reference)
            gateway_status = paystack_data.get("status")
            if gateway_status == "success":
                payment = await payment_repo.update_status(db, payment, "SUCCESSFUL")
                await db.commit()
                await self._send_payment_notifications(db, order, payment)

        return payment

    async def process_webhook(
        self,
        db: AsyncSession,
        raw_body: bytes,
        signature: str
    ) -> Payment:
        # Verify HMAC signature
        if settings.PAYSTACK_SECRET_KEY:
            expected_signature = hmac.new(
                settings.PAYSTACK_SECRET_KEY.encode(),
                raw_body,
                hashlib.sha512
            ).hexdigest()
            if not hmac.compare_digest(expected_signature, signature):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Paystack signature"
                )

        payload = json.loads(raw_body.decode("utf-8"))
        data = payload.get("data", {})
        reference = data.get("reference")

        if not reference:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reference not found in webhook payload."
            )

        payment = await payment_repo.get_by_reference(db, reference)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record with this reference not found."
            )

        if payment.status == "SUCCESSFUL":
            return payment  # Already processed

        if settings.PAYSTACK_SECRET_KEY:
            # Call verify endpoint to prevent fraud
            paystack_data = await self.verify_payment_with_paystack(reference)
            real_status = paystack_data.get("status")
            target_status = "SUCCESSFUL" if real_status == "success" else "FAILED"
        else:
            # In mock/testing mode, trust webhook status directly
            webhook_status = data.get("status")
            target_status = "SUCCESSFUL" if webhook_status == "success" else "FAILED"

        updated_payment = await payment_repo.update_status(db, payment, target_status)
        await db.commit()

        if target_status == "SUCCESSFUL":
            order_result = await db.execute(
                select(Order).where(Order.id == payment.order_id)
            )
            order = order_result.scalars().first()
            if order:
                await self._send_payment_notifications(db, order, updated_payment)

        return updated_payment

    async def list_banks(self) -> list:
        # If secret key is not set, return some mock banks
        if not settings.PAYSTACK_SECRET_KEY:
            return [
                {"name": "Access Bank", "code": "044"},
                {"name": "Guaranty Trust Bank", "code": "058"},
                {"name": "Zenith Bank", "code": "057"},
                {"name": "United Bank for Africa", "code": "033"},
                {"name": "First Bank of Nigeria", "code": "011"}
            ]

        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://api.paystack.co/bank?country=nigeria",
                    headers=headers,
                    timeout=10.0
                )
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Failed to retrieve banks from Paystack."
                    )
                resp_data = response.json()
                if not resp_data.get("status"):
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Paystack banks error: {resp_data.get('message')}"
                    )
                banks = [{"name": b["name"], "code": b["code"]} for b in resp_data["data"]]
                return banks
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Network error contacting Paystack: {str(exc)}"
                )

    async def resolve_account(self, account_number: str, bank_code: str) -> dict:
        if not settings.PAYSTACK_SECRET_KEY:
            return {
                "account_number": account_number,
                "account_name": "MOCK VERIFIED ACCOUNT",
                "bank_id": 9
            }

        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://api.paystack.co/bank/resolve?account_number={account_number}&bank_code={bank_code}",
                    headers=headers,
                    timeout=10.0
                )
                if response.status_code != 200:
                    if response.status_code in (400, 422):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Unable to resolve account details. Please check the bank and account number."
                        )
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Failed to resolve account with Paystack."
                    )
                resp_data = response.json()
                if not resp_data.get("status"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=resp_data.get("message", "Unable to resolve account details.")
                    )
                return resp_data["data"]
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Network error contacting Paystack: {str(exc)}"
                )

    async def _send_payment_notifications(self, db: AsyncSession, order: Order, payment: Payment):
        from app.modules.notifications.service import notification_service
        try:
            await notification_service.create_notification(
                db=db,
                user_id=order.customer_id,
                order_id=order.id,
                title="Payment Successful",
                message=f"Your payment of NGN {payment.amount:,.2f} for order #{str(order.id)[:8]} has been received.",
                notification_type="ORDER_PAID"
            )
            if order.assigned_driver_id:
                await notification_service.create_notification(
                    db=db,
                    user_id=order.assigned_driver_id,
                    order_id=order.id,
                    title="Payment Received",
                    message=f"Payment of NGN {payment.amount:,.2f} for order #{str(order.id)[:8]} has been paid.",
                    notification_type="ORDER_PAID"
                )
        except Exception:
            pass

payment_service = PaymentService()
