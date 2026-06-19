import pytest
from httpx import AsyncClient
import uuid
from app.main import app

@pytest.mark.asyncio
async def test_notifications_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:

        # -----------------------------------------------------------------------
        # SETUP: Users
        # -----------------------------------------------------------------------
        test_id = uuid.uuid4().hex[:6]
        async def register(email, first_name, role, phone):
            # Make email and phone unique for each test run
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

        admin_token,    _           = await register("admin_notif@example.com",    "Admin",    "ADMIN",    "+2348033332001")
        cust_token,     cust_id     = await register("cust_notif@example.com",     "Obinna",   "CUSTOMER", "+2348033332002")
        driver_token,   driver_id   = await register("driver_notif@example.com",   "Emeka",    "DRIVER",   "+2348033332004")
        facility_token, _           = await register("facility_notif@example.com", "Facility", "FACILITY", "+2348033332005")

        # -----------------------------------------------------------------------
        # SETUP: Water source (verified) + ACTIVE tanker for driver
        # -----------------------------------------------------------------------
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Notifications Test Plant",
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

        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": f"ENU-NOTIF-{test_id.upper()}",
            "capacity_litres": 15000,
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

        # -----------------------------------------------------------------------
        # TEST 1: Initial empty notifications list
        # -----------------------------------------------------------------------
        res_notif_cust = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {cust_token}"})
        assert res_notif_cust.status_code == 200
        assert len(res_notif_cust.json()["data"]) == 0

        res_notif_driver = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {driver_token}"})
        assert res_notif_driver.status_code == 200
        assert len(res_notif_driver.json()["data"]) == 0

        # -----------------------------------------------------------------------
        # TEST 2: Trigger ORDER_CREATED Notification for Driver
        # -----------------------------------------------------------------------
        order_payload = {
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 10000,
            "delivery_address": "45 Ogui Road, Enugu",
            "latitude": 6.442,
            "longitude": 7.508,
        }
        res_order = await ac.post("/api/v1/orders", json=order_payload,
                                  headers={"Authorization": f"Bearer {cust_token}"})
        assert res_order.status_code == 201
        order_id = res_order.json()["data"]["order_id"]

        # Driver should now have 1 notification
        res_notif_driver = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {driver_token}"})
        assert res_notif_driver.status_code == 200
        driver_notifs = res_notif_driver.json()["data"]
        assert len(driver_notifs) == 1
        assert driver_notifs[0]["title"] == "New Order Request"
        assert "Obinna" in driver_notifs[0]["message"]
        assert driver_notifs[0]["type"] == "ORDER_CREATED"
        assert driver_notifs[0]["is_read"] is False
        assert driver_notifs[0]["order_id"] == order_id

        # Customer should still have 0 notifications (only driver is notified on creation)
        res_notif_cust = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {cust_token}"})
        assert len(res_notif_cust.json()["data"]) == 0

        # -----------------------------------------------------------------------
        # TEST 3: Trigger ORDER_ACCEPTED Notification for Customer
        # -----------------------------------------------------------------------
        res_accept = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                    json={"status": "ACCEPTED"},
                                    headers={"Authorization": f"Bearer {driver_token}"})
        assert res_accept.status_code == 200

        # Customer should now have 1 notification (Order Accepted)
        res_notif_cust = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {cust_token}"})
        assert res_notif_cust.status_code == 200
        cust_notifs = res_notif_cust.json()["data"]
        assert len(cust_notifs) == 1
        assert cust_notifs[0]["title"] == "Order Accepted"
        assert "Emeka" in cust_notifs[0]["message"]
        assert cust_notifs[0]["type"] == "ORDER_ACCEPTED"
        assert cust_notifs[0]["is_read"] is False

        # -----------------------------------------------------------------------
        # TEST 4: Read notifications
        # -----------------------------------------------------------------------
        notif_id = cust_notifs[0]["id"]
        
        # Read with wrong user (driver trying to read customer's notification)
        res_read_wrong = await ac.put(f"/api/v1/notifications/{notif_id}/read",
                                      headers={"Authorization": f"Bearer {driver_token}"})
        assert res_read_wrong.status_code == 403

        # Read with correct user
        res_read_ok = await ac.put(f"/api/v1/notifications/{notif_id}/read",
                                   headers={"Authorization": f"Bearer {cust_token}"})
        assert res_read_ok.status_code == 200
        assert res_read_ok.json()["data"]["is_read"] is True

        # Verify in list
        res_notif_cust = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {cust_token}"})
        assert res_notif_cust.json()["data"][0]["is_read"] is True

        # -----------------------------------------------------------------------
        # TEST 5: Mark all as read
        # -----------------------------------------------------------------------
        # Driver currently has 1 unread notification
        res_read_all = await ac.put("/api/v1/notifications/read-all",
                                    headers={"Authorization": f"Bearer {driver_token}"})
        assert res_read_all.status_code == 200

        # Verify driver list
        res_notif_driver = await ac.get("/api/v1/notifications", headers={"Authorization": f"Bearer {driver_token}"})
        assert res_notif_driver.json()["data"][0]["is_read"] is True
