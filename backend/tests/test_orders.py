"""
Milestone 10 (updated for marketplace model): Basic Order Placement & Pricing
Tests:
 - Successful order placement with pricing verification
 - Role restriction (only CUSTOMER can place orders)
 - Order detail access control
 - Order listing by role
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta

from app.main import app


@pytest.mark.asyncio
async def test_orders_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:

        # -----------------------------------------------------------------------
        # SETUP: Users
        # -----------------------------------------------------------------------
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

        admin_token,    _           = await register("admin_ord2@example.com",    "Admin",    "ADMIN",    "+2348033330001")
        cust1_token,    cust1_id    = await register("cust1_ord2@example.com",    "Obinna",   "CUSTOMER", "+2348033330002")
        cust2_token,    _           = await register("cust2_ord2@example.com",    "Kene",     "CUSTOMER", "+2348033330003")
        driver_token,   driver_id   = await register("driver_ord2@example.com",  "Emeka",    "DRIVER",   "+2348033330004")
        facility_token, _           = await register("facility_ord2@example.com", "Facility", "FACILITY", "+2348033330005")

        # -----------------------------------------------------------------------
        # SETUP: Water source (verified) + ACTIVE tanker for driver
        # -----------------------------------------------------------------------
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Orders Test Plant",
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
            "plate_number": "ENU-ORD2-001",
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
        # TEST 1: Successful order placement & pricing
        # -----------------------------------------------------------------------

        # Utility: 10000 L @ 1.5 NGN/L = 15000 NGN
        order_utility = {
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 10000,
            "delivery_address": "45 Ogui Road, Enugu",
            "latitude": 6.442,
            "longitude": 7.508,
        }
        res = await ac.post("/api/v1/orders", json=order_utility,
                            headers={"Authorization": f"Bearer {cust1_token}"})
        assert res.status_code == 201, res.text
        assert res.json()["success"] is True
        order1_id = res.json()["data"]["order_id"]
        assert res.json()["data"]["status"] == "PENDING"

        # Drinking: 5000 L @ 2.5 NGN/L = 12500 NGN
        future_time = (datetime.utcnow() + timedelta(days=2)).isoformat()
        order_drinking = {
            "driver_id": driver_id,
            "water_type": "DRINKING",
            "quantity_litres": 5000,
            "delivery_address": "12 Independence Layout, Enugu",
            "latitude": 6.425,
            "longitude": 7.502,
            "scheduled_at": future_time,
        }
        res2 = await ac.post("/api/v1/orders", json=order_drinking,
                             headers={"Authorization": f"Bearer {cust1_token}"})
        assert res2.status_code == 201
        order2_id = res2.json()["data"]["order_id"]

        # -----------------------------------------------------------------------
        # TEST 2: Role restrictions — only CUSTOMER can place orders
        # -----------------------------------------------------------------------
        res_driver_order = await ac.post("/api/v1/orders", json=order_utility,
                                         headers={"Authorization": f"Bearer {driver_token}"})
        assert res_driver_order.status_code == 403

        # -----------------------------------------------------------------------
        # TEST 3: Pricing validation
        # -----------------------------------------------------------------------
        res_det1 = await ac.get(f"/api/v1/orders/{order1_id}",
                                headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_det1.status_code == 200
        det1 = res_det1.json()["data"]
        assert det1["price"] == 15000.0
        assert det1["water_type"] == "UTILITY"
        assert det1["quantity_litres"] == 10000
        assert det1["assigned_driver_id"] == driver_id
        assert det1["assigned_tanker_id"] == tanker_id

        res_det2 = await ac.get(f"/api/v1/orders/{order2_id}",
                                headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_det2.status_code == 200
        det2 = res_det2.json()["data"]
        assert det2["price"] == 12500.0
        assert det2["water_type"] == "DRINKING"
        assert det2["scheduled_at"] is not None

        # -----------------------------------------------------------------------
        # TEST 4: Access control — order detail
        # -----------------------------------------------------------------------
        # Other customer cannot read cust1's order -> 403
        res_c2_read = await ac.get(f"/api/v1/orders/{order1_id}",
                                   headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_c2_read.status_code == 403

        # The assigned driver CAN read the order (they were targeted)
        res_driver_read = await ac.get(f"/api/v1/orders/{order1_id}",
                                       headers={"Authorization": f"Bearer {driver_token}"})
        assert res_driver_read.status_code == 200

        # Admin can read any order
        res_admin_read = await ac.get(f"/api/v1/orders/{order1_id}",
                                      headers={"Authorization": f"Bearer {admin_token}"})
        assert res_admin_read.status_code == 200

        # -----------------------------------------------------------------------
        # TEST 5: Listing orders by role
        # -----------------------------------------------------------------------
        # Customer 1 sees exactly 2 orders
        res_list1 = await ac.get("/api/v1/orders",
                                  headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_list1.status_code == 200
        list1 = res_list1.json()["data"]
        assert len(list1) == 2
        assert any(o["id"] == order1_id for o in list1)
        assert any(o["id"] == order2_id for o in list1)

        # Customer 2 sees 0 orders
        res_list2 = await ac.get("/api/v1/orders",
                                  headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_list2.status_code == 200
        assert len(res_list2.json()["data"]) == 0

        # Driver sees the 2 orders directed at them
        res_driver_list = await ac.get("/api/v1/orders",
                                        headers={"Authorization": f"Bearer {driver_token}"})
        assert res_driver_list.status_code == 200
        driver_orders = res_driver_list.json()["data"]
        assert len(driver_orders) == 2
