import pytest
from httpx import AsyncClient
import uuid
from app.main import app

@pytest.mark.asyncio
async def test_driver_earnings():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        test_id = uuid.uuid4().hex[:6]
        
        # Helper: Register users
        async def register(email, first_name, role, phone):
            parts = email.split("@")
            unique_email = f"{parts[0]}_{test_id}@{parts[1]}"
            unique_phone = f"{phone[:-4]}{uuid.uuid4().int % 10000:04d}"
            res = await ac.post("/api/v1/auth/register", json={
                "email": unique_email,
                "password": "password123",
                "first_name": first_name,
                "last_name": "Test",
                "phone": unique_phone,
                "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token,    _           = await register("admin_earn@example.com",    "Admin",    "ADMIN",    "+2348044442001")
        cust_token,     cust_id     = await register("cust_earn@example.com",     "Obinna",   "CUSTOMER", "+2348044442002")
        driver_token,   driver_id   = await register("driver_earn@example.com",   "Emeka",    "DRIVER",   "+2348044442004")
        facility_token, _           = await register("facility_earn@example.com", "Facility", "FACILITY", "+2348044442005")

        # 1. Create and verify Water Source
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Earnings Test Plant",
            "type": "TREATMENT_PLANT",
            "address": "Test Plant Rd",
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

        # 2. Register and verify Tanker
        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": f"ENU-EARN-{test_id.upper()}",
            "capacity_litres": 10000,
            "default_source_id": source_id,
            "license_documents": "https://example.com/lic.pdf",
            "tanker_image": "https://example.com/img.jpg",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        assert res_tanker.status_code == 201
        tanker_id = res_tanker.json()["data"]["id"]

        await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "ACTIVE"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # 3. Associate tanker with driver
        res_assoc = await ac.put("/api/v1/drivers/me/tanker", json={"tanker_id": tanker_id},
                                 headers={"Authorization": f"Bearer {driver_token}"})
        assert res_assoc.status_code == 200

        # 4. Check initial earnings (should be 0)
        res_earn = await ac.get("/api/v1/drivers/me/earnings", headers={"Authorization": f"Bearer {driver_token}"})
        assert res_earn.status_code == 200
        assert res_earn.json()["data"]["total_earnings"] == 0.0
        assert len(res_earn.json()["data"]["earnings_logs"]) == 0

        # 5. Place order
        res_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "DRINKING",
            "quantity_litres": 5000,
            "delivery_address": "45 Ogui Road, Enugu",
            "latitude": 6.442,
            "longitude": 7.508,
        }, headers={"Authorization": f"Bearer {cust_token}"})
        assert res_order.status_code == 201
        order_id = res_order.json()["data"]["order_id"]

        # Accept, load, deliver
        res_t1 = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "ACCEPTED"},
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert res_t1.status_code == 200, res_t1.text

        res_t2 = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "GOING_TO_SOURCE"},
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert res_t2.status_code == 200, res_t2.text

        res_t3 = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "LOADING_WATER"},
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert res_t3.status_code == 200, res_t3.text

        res_t4 = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "EN_ROUTE"},
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert res_t4.status_code == 200, res_t4.text

        res_t5 = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "ARRIVED"},
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert res_t5.status_code == 200, res_t5.text

        res_t6 = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "DELIVERED"},
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert res_t6.status_code == 200, res_t6.text

        # 6. Initialize and verify payment
        res_pay_init = await ac.post("/api/v1/payments/initialize", json={"order_id": order_id},
                                     headers={"Authorization": f"Bearer {cust_token}"})
        assert res_pay_init.status_code == 200
        checkout_url = res_pay_init.json()["data"]["checkout_url"]
        reference = checkout_url.split("/")[-1]

        # Trigger mock Paystack webhook callback
        res_webhook = await ac.post("/api/v1/payments/webhook", json={
            "event": "charge.success",
            "data": {
                "reference": reference,
                "status": "success",
                "amount": 25000.00
            }
        })
        assert res_webhook.status_code == 200

        # 7. Check earnings (should reflect the paid order price!)
        res_earn_after = await ac.get("/api/v1/drivers/me/earnings", headers={"Authorization": f"Bearer {driver_token}"})
        assert res_earn_after.status_code == 200
        earnings_data = res_earn_after.json()["data"]
        assert earnings_data["total_earnings"] > 0.0
        assert len(earnings_data["earnings_logs"]) == 1
        assert earnings_data["earnings_logs"][0]["order_id"] == order_id
        assert "Obinna" in earnings_data["earnings_logs"][0]["customer_name"]
