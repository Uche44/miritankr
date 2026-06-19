import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
from app.main import app

@pytest.mark.asyncio
async def test_ratings_workflow():
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

        admin_token,    _           = await register("admin_rate@example.com",    "Admin",    "ADMIN",    "+2348033331001")
        cust1_token,    cust1_id    = await register("cust1_rate@example.com",    "Obinna",   "CUSTOMER", "+2348033331002")
        cust2_token,    cust2_id    = await register("cust2_rate@example.com",    "Kene",     "CUSTOMER", "+2348033331003")
        driver_token,   driver_id   = await register("driver_rate@example.com",  "Emeka",    "DRIVER",   "+2348033331004")
        facility_token, _           = await register("facility_rate@example.com", "Facility", "FACILITY", "+2348033331005")

        # -----------------------------------------------------------------------
        # SETUP: Water source (verified) + ACTIVE tanker for driver
        # -----------------------------------------------------------------------
        res_src = await ac.post("/api/v1/water-sources", json={
            "name": "Ratings Test Plant",
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
            "plate_number": "ENU-RATE-001",
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
        # ORDER 1 Placement
        # -----------------------------------------------------------------------
        order_payload1 = {
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 10000,
            "delivery_address": "45 Ogui Road, Enugu",
            "latitude": 6.442,
            "longitude": 7.508,
        }
        res = await ac.post("/api/v1/orders", json=order_payload1,
                            headers={"Authorization": f"Bearer {cust1_token}"})
        assert res.status_code == 201
        order1_id = res.json()["data"]["order_id"]

        # Accept order
        res_accept = await ac.patch(f"/api/v1/orders/{order1_id}/status",
                                    json={"status": "ACCEPTED"},
                                    headers={"Authorization": f"Bearer {driver_token}"})
        assert res_accept.status_code == 200

        # -----------------------------------------------------------------------
        # TEST 1: Fail rating submission when order is NOT delivered
        # -----------------------------------------------------------------------
        rating_payload1 = {
            "rating_water_quality": 5,
            "rating_delivery_speed": 4,
            "rating_driver_professionalism": 5,
            "comments": "Excellent service and water quality!"
        }
        res_rate_pending = await ac.post(f"/api/v1/orders/{order1_id}/rating", json=rating_payload1,
                                         headers={"Authorization": f"Bearer {cust1_token}"})
        # Order is ACCEPTED, not DELIVERED
        assert res_rate_pending.status_code == 400
        assert "not delivered" in res_rate_pending.json()["detail"].lower()

        # -----------------------------------------------------------------------
        # Advance Order 1 to DELIVERED
        # -----------------------------------------------------------------------
        async def advance(order_id, new_status: str):
            r = await ac.patch(f"/api/v1/orders/{order_id}/status",
                               json={"status": new_status},
                               headers={"Authorization": f"Bearer {driver_token}"})
            assert r.status_code == 200, f"Failed to advance to {new_status}: {r.text}"

        await advance(order1_id, "GOING_TO_SOURCE")
        await advance(order1_id, "LOADING_WATER")
        await advance(order1_id, "EN_ROUTE")
        await advance(order1_id, "ARRIVED")
        await advance(order1_id, "DELIVERED")

        # -----------------------------------------------------------------------
        # TEST 2: Role restrictions (only Customer who placed the order can rate)
        # -----------------------------------------------------------------------
        # Non-owner customer
        res_rate_cust2 = await ac.post(f"/api/v1/orders/{order1_id}/rating", json=rating_payload1,
                                       headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_rate_cust2.status_code == 403

        # Driver
        res_rate_driver = await ac.post(f"/api/v1/orders/{order1_id}/rating", json=rating_payload1,
                                        headers={"Authorization": f"Bearer {driver_token}"})
        assert res_rate_driver.status_code == 403

        # -----------------------------------------------------------------------
        # TEST 3: Validation of rating scores (must be between 1 and 5)
        # -----------------------------------------------------------------------
        bad_rating_payload = {
            "rating_water_quality": 6,  # Invalid (> 5)
            "rating_delivery_speed": 4,
            "rating_driver_professionalism": 0,  # Invalid (< 1)
            "comments": "Too high/low grades"
        }
        res_bad_rate = await ac.post(f"/api/v1/orders/{order1_id}/rating", json=bad_rating_payload,
                                     headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_bad_rate.status_code == 422  # Pydantic validation error

        # -----------------------------------------------------------------------
        # TEST 4: Successful rating submission
        # -----------------------------------------------------------------------
        res_rate_ok = await ac.post(f"/api/v1/orders/{order1_id}/rating", json=rating_payload1,
                                    headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_rate_ok.status_code == 201
        data = res_rate_ok.json()
        assert data["success"] is True
        rating1 = data["data"]
        assert rating1["rating_water_quality"] == 5
        assert rating1["rating_delivery_speed"] == 4
        assert rating1["rating_driver_professionalism"] == 5
        assert rating1["comments"] == "Excellent service and water quality!"
        assert rating1["customer_id"] == cust1_id
        assert rating1["driver_id"] == driver_id
        assert rating1["water_source_id"] == source_id

        # -----------------------------------------------------------------------
        # TEST 5: Duplicate ratings block
        # -----------------------------------------------------------------------
        res_rate_dup = await ac.post(f"/api/v1/orders/{order1_id}/rating", json=rating_payload1,
                                     headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_rate_dup.status_code == 400
        assert "has already been rated" in res_rate_dup.json()["detail"]

        # -----------------------------------------------------------------------
        # TEST 6: Get rating details
        # -----------------------------------------------------------------------
        # Placing Customer
        res_get_cust1 = await ac.get(f"/api/v1/orders/{order1_id}/rating",
                                     headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_get_cust1.status_code == 200
        assert res_get_cust1.json()["data"]["id"] == rating1["id"]

        # Assigned Driver
        res_get_driver = await ac.get(f"/api/v1/orders/{order1_id}/rating",
                                      headers={"Authorization": f"Bearer {driver_token}"})
        assert res_get_driver.status_code == 200
        assert res_get_driver.json()["data"]["id"] == rating1["id"]

        # Unrelated customer -> should fail
        res_get_cust2 = await ac.get(f"/api/v1/orders/{order1_id}/rating",
                                     headers={"Authorization": f"Bearer {cust2_token}"})
        assert res_get_cust2.status_code == 403

        # -----------------------------------------------------------------------
        # ORDER 2: Create, Deliver, and Rate to verify Summary Aggregates
        # -----------------------------------------------------------------------
        res_o2 = await ac.post("/api/v1/orders", json=order_payload1,
                               headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_o2.status_code == 201
        order2_id = res_o2.json()["data"]["order_id"]

        # Accept and deliver
        res_accept2 = await ac.patch(f"/api/v1/orders/{order2_id}/status",
                                     json={"status": "ACCEPTED"},
                                     headers={"Authorization": f"Bearer {driver_token}"})
        assert res_accept2.status_code == 200

        await advance(order2_id, "GOING_TO_SOURCE")
        await advance(order2_id, "LOADING_WATER")
        await advance(order2_id, "EN_ROUTE")
        await advance(order2_id, "ARRIVED")
        await advance(order2_id, "DELIVERED")

        # Rate Order 2: Quality = 3, Speed = 2, Professionalism = 3
        rating_payload2 = {
            "rating_water_quality": 3,
            "rating_delivery_speed": 2,
            "rating_driver_professionalism": 3,
            "comments": "Slightly slow delivery."
        }
        res_rate2 = await ac.post(f"/api/v1/orders/{order2_id}/rating", json=rating_payload2,
                                  headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_rate2.status_code == 201

        # -----------------------------------------------------------------------
        # TEST 7: Summary Aggregates (Driver and Water Source)
        # -----------------------------------------------------------------------
        # Driver summary:
        # Averages should be:
        # - quality: (5 + 3)/2 = 4.0
        # - speed: (4 + 2)/2 = 3.0
        # - professionalism: (5 + 3)/2 = 4.0
        # - overall: ( (5+4+5)/3 + (3+2+3)/3 ) / 2 = (4.666... + 2.666...) / 2 = 3.666...
        # Wait, how is overall_average computed in service.py?
        # Let's check ratings service. Typically it's either the average of all category scores or total average.
        # Let's hit the endpoint first to see.
        res_driver_summary = await ac.get(f"/api/v1/drivers/{driver_id}/ratings",
                                          headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_driver_summary.status_code == 200
        summary_d = res_driver_summary.json()["data"]
        assert summary_d["total_ratings_count"] == 2
        assert summary_d["average_water_quality"] == 4.0
        assert summary_d["average_delivery_speed"] == 3.0
        assert summary_d["average_driver_professionalism"] == 4.0
        assert round(summary_d["overall_average"], 2) == 3.67

        # Water source summary:
        res_ws_summary = await ac.get(f"/api/v1/water-sources/{source_id}/ratings",
                                      headers={"Authorization": f"Bearer {cust1_token}"})
        assert res_ws_summary.status_code == 200
        summary_ws = res_ws_summary.json()["data"]
        assert summary_ws["total_ratings_count"] == 2
        assert summary_ws["average_water_quality"] == 4.0
        assert round(summary_ws["overall_average"], 2) == 3.67
