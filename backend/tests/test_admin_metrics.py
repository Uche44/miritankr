import pytest
import uuid
from httpx import AsyncClient
from datetime import datetime, timedelta
from app.main import app

@pytest.mark.asyncio
async def test_admin_metrics_and_audit():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        
        # 1. SETUP: Dynamic randomized accounts to avoid unique constraint collisions
        suffix = uuid.uuid4().hex[:8]
        async def register(email, first_name, role, phone):
            res = await ac.post("/api/v1/auth/register", json={
                "email": f"{suffix}_{email}",
                "password": "password123",
                "first_name": first_name,
                "last_name": "Test",
                "phone": phone,
                "role": role,
            })
            assert res.status_code == 201, res.text
            return res.json()["access_token"], res.json()["user"]["id"]

        admin_token, admin_id = await register("admin_m@example.com", "Admin", "ADMIN", f"+234800000{suffix[:6]}")
        cust_token, cust_id = await register("cust_m@example.com", "Customer", "CUSTOMER", f"+234811111{suffix[:6]}")
        driver_token, driver_id = await register("driver_m@example.com", "Driver", "DRIVER", f"+234822222{suffix[:6]}")
        facility_token, facility_id = await register("fac_m@example.com", "Facility", "FACILITY", f"+234833333{suffix[:6]}")

        # -----------------------------------------------------------------------
        # TEST A: Access Restrictions (Non-Admin Roles Blocked)
        # -----------------------------------------------------------------------
        res_metrics_cust = await ac.get("/api/v1/admin/metrics", headers={"Authorization": f"Bearer {cust_token}"})
        assert res_metrics_cust.status_code == 403

        res_reports_driver = await ac.get("/api/v1/admin/quality-reports", headers={"Authorization": f"Bearer {driver_token}"})
        assert res_reports_driver.status_code == 403

        # -----------------------------------------------------------------------
        # SETUP B: Create Water Sources & Quality Reports
        # -----------------------------------------------------------------------
        res_src1 = await ac.post("/api/v1/water-sources", json={
            "name": f"Source A_{suffix}",
            "type": "TREATMENT_PLANT",
            "address": "Ogui Rd, Enugu",
            "latitude": 6.440,
            "longitude": 7.500,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src1.status_code == 201
        source1_id = res_src1.json()["data"]["id"]

        res_src2 = await ac.post("/api/v1/water-sources", json={
            "name": f"Source B_{suffix}",
            "type": "BOREHOLE",
            "address": "Abakpa, Enugu",
            "latitude": 6.460,
            "longitude": 7.520,
        }, headers={"Authorization": f"Bearer {facility_token}"})
        assert res_src2.status_code == 201
        source2_id = res_src2.json()["data"]["id"]

        # Verify source 1 as Grade A
        await ac.put(
            f"/api/v1/admin/water-sources/{source1_id}/verify",
            json={"verification_status": "VERIFIED", "quality_grade": "A"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Submit Lab Quality Report (tested by Admin as inspector)
        res_lab = await ac.post(
            f"/api/v1/water-sources/{source1_id}/quality-reports",
            json={
                "tested_at": datetime.utcnow().isoformat(),
                "ph": 7.2,
                "tds": 150.0,
                "turbidity": 1.2,
                "grade": "A"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_lab.status_code == 201

        # -----------------------------------------------------------------------
        # SETUP C: Create active Tanker for driver
        # -----------------------------------------------------------------------
        res_tanker = await ac.post("/api/v1/tankers", json={
            "plate_number": f"ENU-{suffix[:4].upper()}-99",
            "capacity_litres": 12000,
            "default_source_id": source1_id,
            "license_documents": "https://example.com/doc.pdf",
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
        # SETUP D: Place and Deliver Orders (Drinking & Utility)
        # -----------------------------------------------------------------------
        # Order 1: DRINKING water, delivered (5000 Litres)
        res_o1 = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "DRINKING",
            "quantity_litres": 5000,
            "delivery_address": "Enugu Main Town",
            "latitude": 6.442,
            "longitude": 7.505,
        }, headers={"Authorization": f"Bearer {cust_token}"})
        assert res_o1.status_code == 201
        order1_id = res_o1.json()["data"]["order_id"]

        # Advance Order 1 to DELIVERED
        async def advance(order_id, status: str):
            r = await ac.patch(
                f"/api/v1/orders/{order_id}/status",
                json={"status": status},
                headers={"Authorization": f"Bearer {driver_token}"}
            )
            assert r.status_code == 200

        await advance(order1_id, "ACCEPTED")
        await advance(order1_id, "GOING_TO_SOURCE")
        await advance(order1_id, "LOADING_WATER")
        await advance(order1_id, "EN_ROUTE")
        await advance(order1_id, "ARRIVED")
        await advance(order1_id, "DELIVERED")

        # Order 2: UTILITY water, delivered (8000 Litres)
        res_o2 = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "UTILITY",
            "quantity_litres": 8000,
            "delivery_address": "Enugu North",
            "latitude": 6.450,
            "longitude": 7.510,
        }, headers={"Authorization": f"Bearer {cust_token}"})
        assert res_o2.status_code == 201
        order2_id = res_o2.json()["data"]["order_id"]

        await advance(order2_id, "ACCEPTED")
        await advance(order2_id, "GOING_TO_SOURCE")
        await advance(order2_id, "LOADING_WATER")
        await advance(order2_id, "EN_ROUTE")
        await advance(order2_id, "ARRIVED")
        await advance(order2_id, "DELIVERED")

        # Order 3: DRINKING water, PENDING/un-delivered (10000 Litres)
        res_o3 = await ac.post("/api/v1/orders", json={
            "driver_id": driver_id,
            "water_type": "DRINKING",
            "quantity_litres": 10000,
            "delivery_address": "Enugu South",
            "latitude": 6.430,
            "longitude": 7.490,
        }, headers={"Authorization": f"Bearer {cust_token}"})
        assert res_o3.status_code == 201

        # -----------------------------------------------------------------------
        # TEST E: Query Admin Metrics Endpoint
        # -----------------------------------------------------------------------
        res_metrics = await ac.get("/api/v1/admin/metrics", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_metrics.status_code == 200
        metrics = res_metrics.json()["data"]

        # Assert correct volume sums for DELIVERED orders
        assert metrics["total_volume_litres"] == 13000.0  # 5000 + 8000
        assert metrics["drinking_volume_litres"] == 5000.0
        assert metrics["utility_volume_litres"] == 8000.0
        
        # Assert order & registry telemetry counts
        assert metrics["total_orders_count"] == 3
        assert metrics["delivered_orders_count"] == 2
        assert metrics["active_tankers_count"] == 1
        assert metrics["verified_sources_count"] == 1  # only source 1 was verified
        assert metrics["total_customers_count"] == 1
        assert metrics["total_drivers_count"] == 1

        # Assert daily trend arrays
        volume_trends = metrics["volume_by_date"]
        assert len(volume_trends) == 7
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        today_trend = next(item for item in volume_trends if item["date"] == today_str)
        assert today_trend["drinking_volume"] == 5000.0
        assert today_trend["utility_volume"] == 8000.0
        assert today_trend["total_volume"] == 13000.0

        # -----------------------------------------------------------------------
        # TEST F: Query safety logs endpoint
        # -----------------------------------------------------------------------
        res_logs = await ac.get("/api/v1/admin/quality-reports", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_logs.status_code == 200
        logs = res_logs.json()["data"]
        
        assert len(logs) >= 1
        source1_log = next(log for log in logs if log["source_id"] == source1_id)
        assert source1_log["source_name"] == f"Source A_{suffix}"
        assert source1_log["ph"] == 7.2
        assert source1_log["tds"] == 150.0
        assert source1_log["turbidity"] == 1.2
        assert source1_log["grade"] == "A"
        assert "Admin" in source1_log["inspector_name"]
