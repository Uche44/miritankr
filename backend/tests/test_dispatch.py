"""
Milestone 11 (Refactored): Driver-Marketplace Order Dispatch
Integration tests for:
 - Customer places order directed at a specific driver (driver_id in payload)
 - System validates driver exists, has ACTIVE tanker, DRINKING orders need verified source
 - Driver sees PENDING requests in their inbox
 - Driver ACCEPTS or REJECTS the order
 - Driver progresses through the full delivery lifecycle after accepting
 - Customer can cancel a PENDING order before driver accepts
 - Admin can cancel any non-terminal order
 - Invalid transitions are rejected with 422
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta

from app.main import app


@pytest.mark.asyncio
async def test_marketplace_full_lifecycle():
    async with AsyncClient(app=app, base_url="http://test") as ac:

        # -----------------------------------------------------------------------
        # SETUP: Register all needed users
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

        admin_token,    admin_id    = await register("admin_mkt@example.com",     "Admin",     "ADMIN",    "+2348011200001")
        customer_token, customer_id = await register("customer_mkt@example.com",  "Customer",  "CUSTOMER", "+2348011200002")
        cust2_token,    _           = await register("customer2_mkt@example.com", "Customer2", "CUSTOMER", "+2348011200003")
        driver_token,   driver_id   = await register("driver_mkt@example.com",   "Driver",    "DRIVER",   "+2348011200004")
        driver2_token,  driver2_id  = await register("driver2_mkt@example.com",  "Driver2",   "DRIVER",   "+2348011200005")
        facility_token, _           = await register("facility_mkt@example.com",  "Facility",  "FACILITY", "+2348011200006")

        # -----------------------------------------------------------------------
        # SETUP: Create & verify a water source
        # -----------------------------------------------------------------------
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Enugu Central Works",
            "type": "TREATMENT_PLANT",
            "address": "7 Water Works Road, Enugu",
            "latitude": 6.441,
            "longitude": 7.509,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src.status_code == 201, res_src.text
        source_id = res_src.json()["data"]["id"]

        await ac.put(
            f"/api/v1/admin/water-sources/{source_id}/verify",
            json={"verification_status": "VERIFIED", "quality_grade": "A"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # -----------------------------------------------------------------------
        # SETUP: Driver registers a tanker (with the verified source as default)
        # -----------------------------------------------------------------------
        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": "ENU-MKT-001",
            "capacity_litres": 20000,
            "default_source_id": source_id,
            "license_documents": "https://example.com/lic.pdf",
            "tanker_image": "https://example.com/img.jpg",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        assert res_tanker.status_code == 201, res_tanker.text
        tanker_id = res_tanker.json()["data"]["id"]

        # -----------------------------------------------------------------------
        # TEST 1: Customer cannot order from driver whose tanker is PENDING (not yet active)
        # -----------------------------------------------------------------------
        res_early_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 5000,
            "delivery_address": "100 Ogui Road, Enugu",
            "latitude": 6.450,
            "longitude": 7.510,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_early_order.status_code == 422
        assert "active" in res_early_order.json()["detail"].lower()

        # Admin activates the tanker
        await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "ACTIVE"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # -----------------------------------------------------------------------
        # TEST 2: Customer cannot order from a non-existent or non-DRIVER user
        # -----------------------------------------------------------------------
        res_bad_driver = await ac.post("/api/v1/orders", json={
            "driver_id": admin_id,  # Admin is not a DRIVER
            "water_type": "UTILITY",
            "quantity_litres": 5000,
            "delivery_address": "100 Ogui Road, Enugu",
            "latitude": 6.450,
            "longitude": 7.510,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_bad_driver.status_code == 404
        assert "driver" in res_bad_driver.json()["detail"].lower()

        # -----------------------------------------------------------------------
        # TEST 3: Successful order placement — driver + tanker auto-resolved
        # -----------------------------------------------------------------------
        order_payload = {
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 5000,
            "delivery_address": "100 Ogui Road, Enugu",
            "latitude": 6.450,
            "longitude": 7.510,
        }
        res_order = await ac.post("/api/v1/orders", json=order_payload,
                                  headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order.status_code == 201, res_order.text
        order_id = res_order.json()["data"]["order_id"]
        assert res_order.json()["data"]["status"] == "PENDING"

        # Price check: 5000 L UTILITY @ 2.0 NGN/L (default source price) + transit cost = 10600.37
        res_detail = await ac.get(f"/api/v1/orders/{order_id}",
                                   headers={"Authorization": f"Bearer {customer_token}"})
        assert res_detail.status_code == 200
        detail = res_detail.json()["data"]
        assert round(detail["price"], 2) == 10600.37
        assert round(detail["water_cost"], 2) == 10000.00
        assert round(detail["transit_cost"], 2) == 600.37
        assert round(detail["distance_km"], 4) == 2.0075
        assert detail["assigned_driver_id"] == driver_id
        assert detail["assigned_tanker_id"] == tanker_id
        assert detail["source_id"] == source_id  # auto-resolved from tanker default

        # -----------------------------------------------------------------------
        # TEST 4: Driver's pending inbox shows the new order
        # -----------------------------------------------------------------------
        res_inbox = await ac.get("/api/v1/orders/pending",
                                  headers={"Authorization": f"Bearer {driver_token}"})
        assert res_inbox.status_code == 200
        inbox_ids = [o["id"] for o in res_inbox.json()["data"]]
        assert order_id in inbox_ids

        # Driver2's inbox is empty — order wasn't sent to them
        res_inbox2 = await ac.get("/api/v1/orders/pending",
                                   headers={"Authorization": f"Bearer {driver2_token}"})
        assert res_inbox2.status_code == 200
        assert len(res_inbox2.json()["data"]) == 0

        # -----------------------------------------------------------------------
        # TEST 5: Driver cannot skip to an invalid status
        # -----------------------------------------------------------------------
        res_skip = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                   json={"status": "GOING_TO_SOURCE"},
                                   headers={"Authorization": f"Bearer {driver_token}"})
        assert res_skip.status_code == 422  # Must ACCEPT first

        # -----------------------------------------------------------------------
        # TEST 6: Driver2 cannot update driver1's order -> 403
        # -----------------------------------------------------------------------
        res_wrong_driver = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                           json={"status": "ACCEPTED"},
                                           headers={"Authorization": f"Bearer {driver2_token}"})
        assert res_wrong_driver.status_code == 403

        # -----------------------------------------------------------------------
        # TEST 7: Driver ACCEPTS the order -> PENDING to ACCEPTED (should succeed immediately without payment)
        # -----------------------------------------------------------------------
        res_accept = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                     json={"status": "ACCEPTED"},
                                     headers={"Authorization": f"Bearer {driver_token}"})
        assert res_accept.status_code == 200, res_accept.text
        assert res_accept.json()["data"]["status"] == "ACCEPTED"
        assert "accepted" in res_accept.json()["message"].lower()

        # Once accepted, no longer in pending inbox
        res_inbox_after = await ac.get("/api/v1/orders/pending",
                                        headers={"Authorization": f"Bearer {driver_token}"})
        assert order_id not in [o["id"] for o in res_inbox_after.json()["data"]]

        # -----------------------------------------------------------------------
        # TEST 8: Full delivery lifecycle progression
        # -----------------------------------------------------------------------
        async def advance(new_status: str):
            r = await ac.patch(f"/api/v1/orders/{order_id}/status",
                               json={"status": new_status},
                               headers={"Authorization": f"Bearer {driver_token}"})
            assert r.status_code == 200, f"Failed to advance to {new_status}: {r.text}"
            assert r.json()["data"]["status"] == new_status

        await advance("GOING_TO_SOURCE")
        await advance("LOADING_WATER")
        await advance("EN_ROUTE")
        await advance("ARRIVED")
        await advance("DELIVERED")

        # -----------------------------------------------------------------------
        # TEST 8.5: Customer completes payment after delivery
        # -----------------------------------------------------------------------
        res_init = await ac.post("/api/v1/payments/initialize", json={"order_id": order_id},
                                 headers={"Authorization": f"Bearer {customer_token}"})
        assert res_init.status_code == 200
        checkout_url = res_init.json()["data"]["checkout_url"]
        reference = checkout_url.split("/")[-1]

        res_wh = await ac.post("/api/v1/payments/webhook", json={
            "event": "charge.success",
            "data": {
                "reference": reference,
                "status": "success"
            }
        })
        assert res_wh.status_code == 200

        # Terminal — cannot update a DELIVERED order
        res_terminal = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                       json={"status": "CANCELLED"},
                                       headers={"Authorization": f"Bearer {driver_token}"})
        assert res_terminal.status_code == 422

        # -----------------------------------------------------------------------
        # TEST 9: Driver REJECTS a different order
        # -----------------------------------------------------------------------
        res_order2 = await ac.post("/api/v1/orders", json=order_payload,
                                    headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order2.status_code == 201
        order2_id = res_order2.json()["data"]["order_id"]

        res_reject = await ac.patch(f"/api/v1/orders/{order2_id}/status",
                                     json={"status": "REJECTED"},
                                     headers={"Authorization": f"Bearer {driver_token}"})
        assert res_reject.status_code == 200
        assert res_reject.json()["data"]["status"] == "REJECTED"
        assert "rejected" in res_reject.json()["message"].lower()

        # Cannot update after REJECTED (terminal)
        res_after_reject = await ac.patch(f"/api/v1/orders/{order2_id}/status",
                                           json={"status": "ACCEPTED"},
                                           headers={"Authorization": f"Bearer {driver_token}"})
        assert res_after_reject.status_code == 422

        # -----------------------------------------------------------------------
        # TEST 10: Customer cancels their own PENDING order
        # -----------------------------------------------------------------------
        res_order3 = await ac.post("/api/v1/orders", json=order_payload,
                                    headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order3.status_code == 201
        order3_id = res_order3.json()["data"]["order_id"]

        # Customer 2 cannot cancel customer 1's order -> 403
        res_c2_cancel = await ac.patch(f"/api/v1/orders/{order3_id}/status",
                                        json={"status": "CANCELLED"},
                                        headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_c2_cancel.status_code == 403

        # Customer 1 cancels their own order -> success
        res_cust_cancel = await ac.patch(f"/api/v1/orders/{order3_id}/status",
                                          json={"status": "CANCELLED"},
                                          headers={"Authorization": f"Bearer {customer_token}"})
        assert res_cust_cancel.status_code == 200
        assert res_cust_cancel.json()["data"]["status"] == "CANCELLED"

        # Double-cancel -> 422
        res_double = await ac.patch(f"/api/v1/orders/{order3_id}/status",
                                     json={"status": "CANCELLED"},
                                     headers={"Authorization": f"Bearer {customer_token}"})
        assert res_double.status_code == 422

        # -----------------------------------------------------------------------
        # TEST 11: Admin cancels a non-terminal order
        # -----------------------------------------------------------------------
        res_order4 = await ac.post("/api/v1/orders", json=order_payload,
                                    headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order4.status_code == 201
        order4_id = res_order4.json()["data"]["order_id"]

        # Admin accepts it (by first having the driver accept... actually admin cannot accept via driver path)
        # Admin can only cancel -> 200
        res_admin_cancel = await ac.patch(f"/api/v1/orders/{order4_id}/status",
                                           json={"status": "CANCELLED"},
                                           headers={"Authorization": f"Bearer {admin_token}"})
        assert res_admin_cancel.status_code == 200
        assert res_admin_cancel.json()["data"]["status"] == "CANCELLED"

        # Admin cannot progress the order (only cancel) -> 403
        res_order5 = await ac.post("/api/v1/orders", json=order_payload,
                                    headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order5.status_code == 201
        order5_id = res_order5.json()["data"]["order_id"]
        res_admin_progress = await ac.patch(f"/api/v1/orders/{order5_id}/status",
                                             json={"status": "ACCEPTED"},
                                             headers={"Authorization": f"Bearer {admin_token}"})
        assert res_admin_progress.status_code == 403

        # -----------------------------------------------------------------------
        # TEST 12: Admin pending queue shows all pending orders
        # -----------------------------------------------------------------------
        res_admin_pending = await ac.get("/api/v1/orders/pending",
                                          headers={"Authorization": f"Bearer {admin_token}"})
        assert res_admin_pending.status_code == 200
        admin_pending_ids = [o["id"] for o in res_admin_pending.json()["data"]]
        assert order5_id in admin_pending_ids

        # -----------------------------------------------------------------------
        # TEST 13: Role listing checks
        # -----------------------------------------------------------------------
        # Driver sees all their orders (all statuses)
        res_driver_all = await ac.get("/api/v1/orders",
                                       headers={"Authorization": f"Bearer {driver_token}"})
        assert res_driver_all.status_code == 200
        driver_order_statuses = {o["status"] for o in res_driver_all.json()["data"]}
        # Should include DELIVERED, REJECTED, CANCELLED, and PENDING
        assert "DELIVERED" in driver_order_statuses
        assert "REJECTED" in driver_order_statuses

        # Customer sees only their own orders
        res_cust_all = await ac.get("/api/v1/orders",
                                     headers={"Authorization": f"Bearer {customer_token}"})
        assert res_cust_all.status_code == 200
        cust_orders = res_cust_all.json()["data"]
        assert all(o["customer_id"] == customer_id for o in cust_orders)


@pytest.mark.asyncio
async def test_drinking_water_unverified_source_rejected():
    """
    Customer cannot order DRINKING water from a driver whose default source is unverified.
    """
    async with AsyncClient(app=app, base_url="http://test") as ac:

        async def register(email, first_name, role, phone):
            res = await ac.post("/api/v1/auth/register", json={
                "email": email, "password": "pass123",
                "first_name": first_name, "last_name": "Test",
                "phone": phone, "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token,    _         = await register("admin_drink2@example.com",    "Admin",    "ADMIN",    "+2348022300001")
        customer_token, _         = await register("customer_drink2@example.com", "Customer", "CUSTOMER", "+2348022300002")
        driver_token,   driver_id = await register("driver_drink2@example.com",  "Driver",   "DRIVER",   "+2348022300003")
        facility_token, _         = await register("facility_drink2@example.com", "Facility", "FACILITY", "+2348022300004")

        # Create an UNVERIFIED source
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Unverified Borehole",
            "type": "BOREHOLE",
            "address": "12 Kufena Road",
            "latitude": 6.460,
            "longitude": 7.520,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src.status_code == 201
        unverified_source_id = res_src.json()["data"]["id"]

        # Driver registers tanker with unverified source as default
        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": "ENU-DRINK2-01",
            "capacity_litres": 5000,
            "default_source_id": unverified_source_id,
            "license_documents": "https://example.com/lic2.pdf",
            "tanker_image": "https://example.com/img2.jpg",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        assert res_tanker.status_code == 201

        # Admin activates the tanker
        tanker_id = res_tanker.json()["data"]["id"]
        await ac.put(f"/api/v1/admin/tankers/{tanker_id}/status",
                     json={"status": "ACTIVE"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        # Customer tries DRINKING order -> 422 (unverified source)
        res_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "DRINKING",
            "quantity_litres": 2000,
            "delivery_address": "50 Independence Layout",
            "latitude": 6.430,
            "longitude": 7.500,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order.status_code == 422
        assert "verified" in res_order.json()["detail"].lower()

        # UTILITY order works fine with the same driver
        res_utility = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 2000,
            "delivery_address": "50 Independence Layout",
            "latitude": 6.430,
            "longitude": 7.500,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_utility.status_code == 201
