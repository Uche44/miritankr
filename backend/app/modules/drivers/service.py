import uuid
from datetime import datetime
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.drivers.models import Driver
from app.modules.drivers.repository import driver_repo
from app.modules.drivers.schemas import (
    DriverStatusUpdate,
    DriverLocationUpdate,
    DriverTankerUpdate,
    DriverDetailResponse,
    DriverUserDetail,
    DriverTankerDetail,
    DriverBankAccountUpdate
)
from app.modules.auth.repository import user_repo
from app.modules.tankers.repository import tanker_repo
from app.modules.tankers.service import tanker_service

class DriverService:
    async def get_driver_or_create(self, db: AsyncSession, driver_id: uuid.UUID) -> Driver:
        """
        Get the driver's profile. Creates it lazily if user has DRIVER role but no profile yet.
        """
        driver = await driver_repo.get_by_id(db, driver_id)
        if not driver:
            # Check if user exists and is a Driver
            user = await user_repo.get_by_id(db, driver_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User profile not found."
                )
            if user.role != "DRIVER":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. User does not have Driver permissions."
                )
            # Create lazy default driver record
            driver = await driver_repo.create_default(db, driver_id)
            await db.commit()
            # Reload to pop relationships
            driver = await driver_repo.get_by_id(db, driver_id)
        return driver

    async def update_status(
        self, 
        db: AsyncSession, 
        driver_id: uuid.UUID, 
        status_in: DriverStatusUpdate
    ) -> Driver:
        """
        Update the driver's availability status.
        """
        driver = await self.get_driver_or_create(db, driver_id)
        
        # If trying to go active (AVAILABLE), check that they have an active tanker assigned
        if status_in.status == "AVAILABLE" and not driver.tanker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set status to AVAILABLE without an assigned active tanker.",
            )

        updated_driver = await driver_repo.update(db, driver, {"status": status_in.status})
        await db.commit()
        return updated_driver

    async def update_location(
        self, 
        db: AsyncSession, 
        driver_id: uuid.UUID, 
        location_in: DriverLocationUpdate
    ) -> Driver:
        """
        Update the driver's live GPS coordinates.
        """
        driver = await self.get_driver_or_create(db, driver_id)
        update_data = {
            "latitude": location_in.latitude,
            "longitude": location_in.longitude,
            "last_location_update": datetime.utcnow()
        }
        updated_driver = await driver_repo.update(db, driver, update_data)
        await db.commit()

        # Broadcast live GPS telemetry to active orders
        from app.modules.orders.models import Order
        from sqlalchemy import select
        from app.modules.tracking.websocket import manager

        result = await db.execute(
            select(Order).where(
                Order.assigned_driver_id == driver_id,
                Order.status.in_(["ACCEPTED", "GOING_TO_SOURCE", "LOADING_WATER", "EN_ROUTE", "ARRIVED"])
            )
        )
        active_orders = result.scalars().all()
        for order in active_orders:
            await manager.broadcast_to_order(
                str(order.id),
                {
                    "event": "DRIVER_LOCATION_UPDATED",
                    "data": {
                        "order_id": str(order.id),
                        "latitude": location_in.latitude,
                        "longitude": location_in.longitude,
                    }
                }
            )

        return updated_driver

    async def assign_tanker(
        self, 
        db: AsyncSession, 
        driver_id: uuid.UUID, 
        tanker_in: DriverTankerUpdate
    ) -> Driver:
        """
        Assign a tanker to the driver. The driver must own the tanker, and the tanker must be ACTIVE.
        """
        driver = await self.get_driver_or_create(db, driver_id)

        if tanker_in.tanker_id is None:
            # Unassign tanker, and force status to OFFLINE since they no longer have a tanker
            updated_driver = await driver_repo.update(db, driver, {"tanker_id": None, "status": "OFFLINE"})
            await db.commit()
            return updated_driver

        # Fetch and validate tanker
        tanker = await tanker_repo.get_by_id(db, tanker_in.tanker_id)
        if not tanker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tanker not found."
            )
        
        if tanker.owner_id != driver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied. You do not own this tanker."
            )

        if tanker.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot assign tanker. Tanker status is '{tanker.status}'. It must be APPROVED and ACTIVE."
            )

        updated_driver = await driver_repo.update(db, driver, {"tanker_id": tanker.id})
        await db.commit()
        return updated_driver

    async def list_active_drivers(self, db: AsyncSession) -> List[Driver]:
        """
        Retrieve all available drivers.
        """
        return await driver_repo.get_active_drivers(db)

    async def build_detail_response(self, db: AsyncSession, driver: Driver) -> DriverDetailResponse:
        """
        Build the rich DriverDetailResponse nested object dynamically resolving relations.
        """
        user_detail = DriverUserDetail(
            first_name=driver.user.first_name,
            last_name=driver.user.last_name,
            phone=driver.user.phone,
            email=driver.user.email
        )

        tanker_detail = None
        if driver.tanker:
            is_eligible = await tanker_service.calculate_drinking_eligibility(db, driver.tanker)
            tanker_detail = DriverTankerDetail(
                id=driver.tanker.id,
                plate_number=driver.tanker.plate_number,
                capacity_litres=driver.tanker.capacity_litres,
                is_eligible_for_drinking=is_eligible,
                status=driver.tanker.status,
                default_source_id=driver.tanker.default_source_id
            )

        return DriverDetailResponse(
            id=driver.id,
            status=driver.status,
            latitude=driver.latitude,
            longitude=driver.longitude,
            last_location_update=driver.last_location_update,
            user=user_detail,
            tanker=tanker_detail,
            bank_code=driver.bank_code,
            bank_name=driver.bank_name,
            account_number=driver.account_number,
            account_name=driver.account_name
        )

    async def get_driver_earnings(self, db: AsyncSession, driver_id: uuid.UUID):
        """
        Fetch all successful payments for orders assigned to this driver and compute aggregate.
        """
        from app.modules.payments.models import Payment
        from app.modules.orders.models import Order
        from app.modules.auth.models import User
        from sqlalchemy import select

        stmt = (
            select(Payment, Order, User)
            .join(Order, Payment.order_id == Order.id)
            .join(User, Order.customer_id == User.id)
            .where(Order.assigned_driver_id == driver_id)
            .where(Payment.status == "SUCCESSFUL")
            .order_by(Payment.timestamp.desc())
        )
        
        result = await db.execute(stmt)
        rows = result.all()

        earnings_logs = []
        total_earnings = 0.0

        for payment, order, customer in rows:
            amount = float(payment.amount)
            total_earnings += amount
            earnings_logs.append({
                "payment_id": payment.id,
                "payment_reference": payment.reference,
                "amount": amount,
                "timestamp": payment.timestamp,
                "order_id": order.id,
                "customer_name": f"{customer.first_name} {customer.last_name}",
                "water_type": order.water_type,
                "quantity_litres": order.quantity_litres
            })

        return {
            "total_earnings": total_earnings,
            "earnings_logs": earnings_logs
        }

    async def update_bank_account(
        self,
        db: AsyncSession,
        driver_id: uuid.UUID,
        payload: DriverBankAccountUpdate
    ) -> Driver:
        """
        Update the driver's bank account details.
        """
        driver = await self.get_driver_or_create(db, driver_id)
        update_data = {
            "bank_code": payload.bank_code,
            "bank_name": payload.bank_name,
            "account_number": payload.account_number,
            "account_name": payload.account_name
        }
        updated_driver = await driver_repo.update(db, driver, update_data)
        await db.commit()
        return updated_driver

driver_service = DriverService()
