import asyncio
import uuid
import logging
from typing import Dict
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.modules.orders.models import Order
from app.modules.drivers.models import Driver
from app.modules.tracking.websocket import manager

logger = logging.getLogger(__name__)

# Registry of active simulation tasks: order_id -> asyncio.Task
active_simulations: Dict[uuid.UUID, asyncio.Task] = {}

async def _simulate_movement_loop(
    order_id: uuid.UUID,
    start_lat: float,
    start_lng: float,
    target_lat: float,
    target_lng: float,
    driver_id: uuid.UUID,
):
    steps = 10  # 10 steps to reach the destination
    delay = 3.0  # 3 seconds between steps
    
    current_lat = start_lat
    current_lng = start_lng

    logger.info(f"Starting WS telemetry simulation loop for order {order_id}. Start: ({start_lat}, {start_lng}) -> Target: ({target_lat}, {target_lng})")

    for i in range(1, steps + 1):
        fraction = i / steps
        current_lat = start_lat + (target_lat - start_lat) * fraction
        current_lng = start_lng + (target_lng - start_lng) * fraction
        
        try:
            async with AsyncSessionLocal() as db:
                # 1. Update driver location in database
                result = await db.execute(
                    select(Driver).where(Driver.id == driver_id)
                )
                driver = result.scalars().first()
                if driver:
                    driver.latitude = current_lat
                    driver.longitude = current_lng
                    db.add(driver)
                    await db.commit()
                
                # Check if order is still active
                order_result = await db.execute(
                    select(Order).where(Order.id == order_id)
                )
                order = order_result.scalars().first()
                if not order or order.status in ["DELIVERED", "ARRIVED", "CANCELLED", "REJECTED"]:
                    logger.info(f"Stopping telemetry simulation for order {order_id} (status: {order.status if order else 'None'}).")
                    break
        except Exception as e:
            logger.error(f"Error in telemetry simulation database update: {e}")
            break

        # 2. Broadcast updated location via WebSocket
        await manager.broadcast_to_order(
            str(order_id),
            {
                "event": "DRIVER_LOCATION_UPDATED",
                "data": {
                    "order_id": str(order_id),
                    "latitude": current_lat,
                    "longitude": current_lng,
                }
            }
        )
        
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            logger.info(f"Simulation sleep cancelled for order {order_id}.")
            raise
        
    active_simulations.pop(order_id, None)

def start_simulation(
    order_id: uuid.UUID,
    start_lat: float,
    start_lng: float,
    target_lat: float,
    target_lng: float,
    driver_id: uuid.UUID,
):
    # Cancel any active simulation for this order
    stop_simulation(order_id)
    
    task = asyncio.create_task(
        _simulate_movement_loop(
            order_id=order_id,
            start_lat=start_lat,
            start_lng=start_lng,
            target_lat=target_lat,
            target_lng=target_lng,
            driver_id=driver_id,
        )
    )
    active_simulations[order_id] = task

def stop_simulation(order_id: uuid.UUID):
    task = active_simulations.pop(order_id, None)
    if task:
        task.cancel()
