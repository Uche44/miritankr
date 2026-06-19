import pytest
import uuid
from fastapi.testclient import TestClient
from fastapi import status
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_websocket_tracking_workflow():
    # Setup database records using REST AsyncClient
    async with AsyncClient(app=app, base_url="http://test") as ac:
        
        # 1. Register users
        async def register(email, first_name, role, phone):
            res = await ac.post("/api/v1/auth/register", json={
                "email": email, "password": "password123",
                "first_name": first_name, "last_name": "WS",
                "phone": phone, "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token, _ = await register("admin_ws@example.com", "Admin", "ADMIN", "+2348077700001")
        customer_token, cust_id = await register("customer_ws@example.com", "Customer", "CUSTOMER", "+2348077700002")
        cust2_token, _ = await register("cust2_ws@example.com", "Customer2", "CUSTOMER", "+2348077700003")
        driver_token, driver_id = await register("driver_ws@example.com", "Driver", "DRIVER", "+2348077700004")
        facility_token, _ = await register("facility_ws@example.com", "Facility", "FACILITY", "+2348077700005")

        # Create active water source and driver tanker
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "WS Test Plant",
            "type": "TREATMENT_PLANT",
            "address": "WS Street, Enugu",
            "latitude": 6.441,
            "longitude": 7.509,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src.status_code == 201
        source_id = res_src.json()["data"]["id"]

        await ac.put(f"/api/v1/admin/water-sources/{source_id}/verify",
                     json={"verification_status": "VERIFIED", "quality_grade": "A"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": "ENU-WS-001",
            "capacity_litres": 10000,
            "default_source_id": source_id,
            "license_documents": "docs",
            "tanker_image": "image",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        assert res_tanker.status_code == 201
        tanker_id = res_tanker.json()["data"]["id"]

        await ac.put(f"/api/v1/admin/tankers/{tanker_id}/status",
                     json={"status": "ACTIVE"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        # Create Order
        res_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 5000,
            "delivery_address": "WS Delivery, Enugu",
            "latitude": 6.450,
            "longitude": 7.510,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order.status_code == 201, res_order.text
        order_id = res_order.json()["data"]["order_id"]

        # Now test WebSocket connections using TestClient
        client = TestClient(app)

        # A. Connection fails with missing or invalid token
        try:
            with client.websocket_connect(f"/api/v1/ws/orders/{order_id}/tracking") as ws:
                ws.receive_json()
            assert False, "Should have failed with missing token"
        except Exception:
            pass

        try:
            with client.websocket_connect(f"/api/v1/ws/orders/{order_id}/tracking?token=invalid_token") as ws:
                ws.receive_json()
            assert False, "Should have failed with invalid token"
        except Exception:
            pass

        # B. Connection fails for unauthorized user (cust2)
        try:
            with client.websocket_connect(f"/api/v1/ws/orders/{order_id}/tracking?token={cust2_token}") as ws:
                ws.receive_json()
            assert False, "Should have failed for unauthorized user"
        except Exception:
            pass

        # C. Authorized connection succeeds (Customer) and receives status update
        with client.websocket_connect(f"/api/v1/ws/orders/{order_id}/tracking?token={customer_token}") as ws:
            # In a separate request, let the driver accept the order
            res_accept = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                         json={"status": "ACCEPTED"},
                                         headers={"Authorization": f"Bearer {driver_token}"})
            assert res_accept.status_code == 200

            # The WebSocket client should receive ORDER_STATUS_CHANGED event
            msg = ws.receive_json()
            assert msg["event"] == "ORDER_STATUS_CHANGED"
            assert msg["data"]["order_id"] == order_id
            assert msg["data"]["status"] == "ACCEPTED"

            # In a separate request, update driver location
            res_loc = await ac.put("/api/v1/drivers/me/location",
                                    json={"latitude": 6.445, "longitude": 7.502},
                                    headers={"Authorization": f"Bearer {driver_token}"})
            assert res_loc.status_code == 200

            # The WebSocket client should receive DRIVER_LOCATION_UPDATED event
            msg = ws.receive_json()
            assert msg["event"] == "DRIVER_LOCATION_UPDATED"
            assert msg["data"]["order_id"] == order_id
            assert msg["data"]["latitude"] == 6.445
            assert msg["data"]["longitude"] == 7.502
