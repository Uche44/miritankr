import pytest
from httpx import AsyncClient
import uuid
from app.main import app

@pytest.mark.asyncio
async def test_payments_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        
        # 1. SETUP: Register users
        async def register(email, first_name, role, phone):
            res = await ac.post("/api/v1/auth/register", json={
                "email": email,
                "password": "password123",
                "first_name": first_name,
                "last_name": "Test",
                "phone": phone,
                "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token,    _           = await register("admin_pay@example.com",    "Admin",    "ADMIN",    "+2348055550001")
        customer_token, customer_id = await register("customer_pay@example.com", "Obinna",   "CUSTOMER", "+2348055550002")
        driver_token,   driver_id   = await register("driver_pay@example.com",   "Emeka",    "DRIVER",   "+2348055550003")
        facility_token, _           = await register("facility_pay@example.com", "Facility", "FACILITY", "+2348055550004")

        # 2. SETUP: Create active water source and driver tanker
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Payments Test Source",
            "type": "BOREHOLE",
            "address": "Borehole Depot, Enugu",
            "latitude": 6.44,
            "longitude": 7.50,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src.status_code == 201
        source_id = res_src.json()["data"]["id"]

        await ac.put(
            f"/api/v1/admin/water-sources/{source_id}/verify",
            json={"verification_status": "VERIFIED", "quality_grade": "A"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": "ENU-PAY-001",
            "capacity_litres": 10000,
            "default_source_id": source_id,
            "license_documents": "docs",
            "tanker_image": "image",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        assert res_tanker.status_code == 201
        tanker_id = res_tanker.json()["data"]["id"]

        await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "ACTIVE"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # 3. Create an order (Auto-initializes a PENDING payment record)
        res_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 5000,
            "delivery_address": "Enugu City Center",
            "latitude": 6.442,
            "longitude": 7.508,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order.status_code == 201
        order_id = res_order.json()["data"]["order_id"]

        # 4. TEST: Driver accepts order (should succeed without payment)
        res_accept = await ac.patch(
            f"/api/v1/orders/{order_id}/status",
            json={"status": "ACCEPTED"},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_accept.status_code == 200, res_accept.text
        assert res_accept.json()["data"]["status"] == "ACCEPTED"

        # 5. TEST: Initialize payment before delivery -> returns 400 Bad Request
        res_init_early = await ac.post(
            "/api/v1/payments/initialize",
            json={"order_id": order_id},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert res_init_early.status_code == 400
        assert "only be processed after" in res_init_early.json()["detail"].lower()

        # 6. Progress order through status transitions to DELIVERED
        async def advance(new_status: str):
            r = await ac.patch(f"/api/v1/orders/{order_id}/status",
                               json={"status": new_status},
                               headers={"Authorization": f"Bearer {driver_token}"})
            assert r.status_code == 200, f"Failed advancing to {new_status}: {r.text}"

        await advance("GOING_TO_SOURCE")
        await advance("LOADING_WATER")
        await advance("EN_ROUTE")
        await advance("ARRIVED")
        await advance("DELIVERED")

        # 7. TEST: Initialize payment (now allowed since DELIVERED)
        res_init = await ac.post(
            "/api/v1/payments/initialize",
            json={"order_id": order_id},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert res_init.status_code == 200
        checkout_url = res_init.json()["data"]["checkout_url"]
        assert "checkout.paystack.com" in checkout_url
        reference = checkout_url.split("/")[-1]

        # 8. TEST: Verify payment status shows PENDING
        res_verify_pending = await ac.get(
            f"/api/v1/payments/verify/{reference}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert res_verify_pending.status_code == 200
        assert res_verify_pending.json()["data"]["status"] == "PENDING"

        # 9. TEST: Trigger successful mock webhook callback
        res_webhook = await ac.post(
            "/api/v1/payments/webhook",
            json={
                "event": "charge.success",
                "data": {
                    "reference": reference,
                    "status": "success",
                    "amount": 7500.00
                }
            }
        )
        assert res_webhook.status_code == 200
        assert res_webhook.json()["status"] == "success"

        # 10. TEST: Verify payment status shows SUCCESSFUL
        res_verify_success = await ac.get(
            f"/api/v1/payments/verify/{reference}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert res_verify_success.status_code == 200
        assert res_verify_success.json()["data"]["status"] == "SUCCESSFUL"

        # 11. TEST: Re-initializing paid order -> returns 400
        res_reinit = await ac.post(
            "/api/v1/payments/initialize",
            json={"order_id": order_id},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert res_reinit.status_code == 400
