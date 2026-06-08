"""
Milestone 12: Tracking Events & Delivery Timeline
Integration tests for:
 - ORDER_CREATED event auto-appended when order is placed
 - ORDER_ACCEPTED / ORDER_REJECTED events on driver response
 - Full delivery lifecycle produces a complete ordered event log
 - Timeline is immutable (events never change, only grow)
 - GET /orders/{id}/tracking returns live snapshot with source details
 - GET /orders/{id}/tracking/timeline returns full event history
 - Access control: customer/driver/admin can read, others get 403
"""
import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_tracking_full_lifecycle():
    async with AsyncClient(app=app, base_url="http://test") as ac:

        # -----------------------------------------------------------------------
        # SETUP: Users, water source, tanker
        # -----------------------------------------------------------------------
        async def register(email, first_name, role, phone):
            res = await ac.post("/api/v1/auth/register", json={
                "email": email, "password": "password123",
                "first_name": first_name, "last_name": "Track",
                "phone": phone, "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token,   admin_id   = await register("admin_trk@example.com",    "Admin",    "ADMIN",    "+2348044400001")
        customer_token, cust_id   = await register("customer_trk@example.com", "Customer", "CUSTOMER", "+2348044400002")
        cust2_token,   _          = await register("cust2_trk@example.com",    "Customer2","CUSTOMER", "+2348044400003")
        driver_token,  driver_id  = await register("driver_trk@example.com",   "Driver",   "DRIVER",   "+2348044400004")
        facility_token, _         = await register("facility_trk@example.com", "Facility", "FACILITY", "+2348044400005")

        # Water source (verified)
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Tracking Test Plant",
            "type": "TREATMENT_PLANT",
            "address": "1 Track Road, Enugu",
            "latitude": 6.441,
            "longitude": 7.509,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src.status_code == 201
        source_id = res_src.json()["data"]["id"]

        await ac.put(f"/api/v1/admin/water-sources/{source_id}/verify",
                     json={"verification_status": "VERIFIED", "quality_grade": "A"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        # Driver's tanker
        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": "ENU-TRK-001",
            "capacity_litres": 10000,
            "default_source_id": source_id,
            "license_documents": "https://example.com/lic.pdf",
            "tanker_image": "https://example.com/img.jpg",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        assert res_tanker.status_code == 201
        tanker_id = res_tanker.json()["data"]["id"]

        await ac.put(f"/api/v1/admin/tankers/{tanker_id}/status",
                     json={"status": "ACTIVE"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        # -----------------------------------------------------------------------
        # TEST 1: ORDER_CREATED event is auto-appended on order placement
        # -----------------------------------------------------------------------
        res_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 5000,
            "delivery_address": "100 Test Street, Enugu",
            "latitude": 6.450,
            "longitude": 7.510,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert res_order.status_code == 201, res_order.text
        order_id = res_order.json()["data"]["order_id"]

        # Check timeline has ORDER_CREATED
        res_timeline = await ac.get(f"/api/v1/orders/{order_id}/tracking/timeline",
                                     headers={"Authorization": f"Bearer {customer_token}"})
        assert res_timeline.status_code == 200, res_timeline.text
        events = res_timeline.json()["data"]
        assert len(events) == 1
        assert events[0]["event_type"] == "ORDER_CREATED"
        assert events[0]["order_id"] == order_id

        # -----------------------------------------------------------------------
        # TEST 2: Access control on tracking endpoints
        # -----------------------------------------------------------------------
        # Customer2 (unrelated) cannot see tracking -> 403
        res_c2_trk = await ac.get(f"/api/v1/orders/{order_id}/tracking",
                                   headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_c2_trk.status_code == 403

        res_c2_tl = await ac.get(f"/api/v1/orders/{order_id}/tracking/timeline",
                                  headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_c2_tl.status_code == 403

        # Assigned driver can see tracking (order is now directed at them)
        res_drv_trk = await ac.get(f"/api/v1/orders/{order_id}/tracking",
                                    headers={"Authorization": f"Bearer {driver_token}"})
        assert res_drv_trk.status_code == 200

        # Admin can see tracking
        res_adm_trk = await ac.get(f"/api/v1/orders/{order_id}/tracking",
                                    headers={"Authorization": f"Bearer {admin_token}"})
        assert res_adm_trk.status_code == 200

        # -----------------------------------------------------------------------
        # TEST 3: Driver ACCEPTS -> ORDER_ACCEPTED event appended
        # -----------------------------------------------------------------------
        res_accept = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                     json={"status": "ACCEPTED"},
                                     headers={"Authorization": f"Bearer {driver_token}"})
        assert res_accept.status_code == 200

        res_tl = await ac.get(f"/api/v1/orders/{order_id}/tracking/timeline",
                               headers={"Authorization": f"Bearer {customer_token}"})
        events = res_tl.json()["data"]
        assert len(events) == 2
        assert events[0]["event_type"] == "ORDER_CREATED"
        assert events[1]["event_type"] == "ORDER_ACCEPTED"
        assert events[1]["actor_id"] == driver_id

        # -----------------------------------------------------------------------
        # TEST 4: Full delivery lifecycle produces complete ordered event log
        # -----------------------------------------------------------------------
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

        res_final_tl = await ac.get(f"/api/v1/orders/{order_id}/tracking/timeline",
                                     headers={"Authorization": f"Bearer {customer_token}"})
        assert res_final_tl.status_code == 200
        final_events = res_final_tl.json()["data"]

        # Should have 8 events total
        event_types = [e["event_type"] for e in final_events]
        expected_sequence = [
            "ORDER_CREATED",
            "ORDER_ACCEPTED",
            "GOING_TO_SOURCE",
            "WATER_LOADED",
            "EN_ROUTE",
            "ARRIVED",
            "DELIVERED",
        ]
        assert event_types == expected_sequence, f"Unexpected event sequence: {event_types}"

        # -----------------------------------------------------------------------
        # TEST 5: Live tracking snapshot contains source details
        # -----------------------------------------------------------------------
        res_live = await ac.get(f"/api/v1/orders/{order_id}/tracking",
                                 headers={"Authorization": f"Bearer {customer_token}"})
        assert res_live.status_code == 200
        snapshot = res_live.json()["data"]

        assert snapshot["order_status"] == "DELIVERED"
        assert snapshot["order_id"] == order_id

        # Source location should be populated
        src_snap = snapshot["source_location"]
        assert src_snap["id"] == source_id
        assert src_snap["name"] == "Tracking Test Plant"
        assert src_snap["verification_status"] == "VERIFIED"
        assert src_snap["quality_grade"] == "A"

        # Timeline in snapshot should match the full timeline
        assert len(snapshot["timeline"]) == len(final_events)


@pytest.mark.asyncio
async def test_tracking_rejection_event():
    """Driver rejecting an order creates an ORDER_REJECTED tracking event."""
    async with AsyncClient(app=app, base_url="http://test") as ac:

        async def register(email, first_name, role, phone):
            res = await ac.post("/api/v1/auth/register", json={
                "email": email, "password": "password123",
                "first_name": first_name, "last_name": "Track",
                "phone": phone, "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token,   _          = await register("admin_trk2@example.com",    "Admin",    "ADMIN",    "+2348044410001")
        customer_token, _         = await register("customer_trk2@example.com", "Customer", "CUSTOMER", "+2348044410002")
        driver_token,  driver_id  = await register("driver_trk2@example.com",  "Driver",   "DRIVER",   "+2348044410003")
        facility_token, _         = await register("facility_trk2@example.com", "Facility", "FACILITY", "+2348044410004")

        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Rejection Test Plant",
            "type": "TREATMENT_PLANT",
            "address": "2 Track Road",
            "latitude": 6.44,
            "longitude": 7.51,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        source_id = res_src.json()["data"]["id"]

        await ac.put(f"/api/v1/admin/water-sources/{source_id}/verify",
                     json={"verification_status": "VERIFIED", "quality_grade": "B"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": "ENU-REJ-001",
            "capacity_litres": 5000,
            "default_source_id": source_id,
            "license_documents": "https://example.com/lic.pdf",
            "tanker_image": "https://example.com/img.jpg",
        }, headers={"Authorization": f"Bearer {driver_token}"})
        tanker_id = res_tanker.json()["data"]["id"]
        await ac.put(f"/api/v1/admin/tankers/{tanker_id}/status",
                     json={"status": "ACTIVE"},
                     headers={"Authorization": f"Bearer {admin_token}"})

        res_order = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 2000,
            "delivery_address": "50 Test Ave",
            "latitude": 6.430,
            "longitude": 7.500,
        }, headers={"Authorization": f"Bearer {customer_token}"})
        order_id = res_order.json()["data"]["order_id"]

        # Driver rejects
        res_reject = await ac.patch(f"/api/v1/orders/{order_id}/status",
                                     json={"status": "REJECTED"},
                                     headers={"Authorization": f"Bearer {driver_token}"})
        assert res_reject.status_code == 200

        # Timeline: ORDER_CREATED -> ORDER_REJECTED
        res_tl = await ac.get(f"/api/v1/orders/{order_id}/tracking/timeline",
                               headers={"Authorization": f"Bearer {customer_token}"})
        events = res_tl.json()["data"]
        assert len(events) == 2
        assert events[0]["event_type"] == "ORDER_CREATED"
        assert events[1]["event_type"] == "ORDER_REJECTED"
