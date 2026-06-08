import pytest
from httpx import AsyncClient
import uuid

from app.main import app
from app.modules.tankers.models import Tanker
from app.modules.tankers.service import tanker_service
from app.modules.water_sources.models import WaterSource

@pytest.mark.asyncio
async def test_tankers_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # --- PREPARATION: Create Test Users ---
        
        # 1. Register a Customer
        customer_reg = {
            "email": "customer_tanker@example.com",
            "password": "password123",
            "first_name": "John",
            "last_name": "Customer",
            "phone": "+2348011112222",
            "role": "CUSTOMER"
        }
        res_cust = await ac.post("/api/v1/auth/register", json=customer_reg)
        assert res_cust.status_code == 201
        cust_token = res_cust.json()["access_token"]

        # 2. Register a Facility
        facility_reg = {
            "email": "facility_tanker@example.com",
            "password": "password123",
            "first_name": "Tunde",
            "last_name": "Facility",
            "phone": "+2348022223333",
            "role": "FACILITY"
        }
        res_fac = await ac.post("/api/v1/auth/register", json=facility_reg)
        assert res_fac.status_code == 201
        facility_token = res_fac.json()["access_token"]

        # 3. Register a Driver (Driver 1)
        driver_reg = {
            "email": "driver1_tanker@example.com",
            "password": "password123",
            "first_name": "Chinedu",
            "last_name": "Driver",
            "phone": "+2348044445555",
            "role": "DRIVER"
        }
        res_driver = await ac.post("/api/v1/auth/register", json=driver_reg)
        assert res_driver.status_code == 201
        driver_token = res_driver.json()["access_token"]

        # 4. Register another Driver (Driver 2)
        driver2_reg = {
            "email": "driver2_tanker@example.com",
            "password": "password123",
            "first_name": "Emeka",
            "last_name": "Driver",
            "phone": "+2348055556666",
            "role": "DRIVER"
        }
        res_driver2 = await ac.post("/api/v1/auth/register", json=driver2_reg)
        assert res_driver2.status_code == 201
        driver2_token = res_driver2.json()["access_token"]

        # 5. Register an Admin
        admin_reg = {
            "email": "admin_tanker@example.com",
            "password": "password123",
            "first_name": "Ada",
            "last_name": "Admin",
            "phone": "+2348033334444",
            "role": "ADMIN"
        }
        res_admin = await ac.post("/api/v1/auth/register", json=admin_reg)
        assert res_admin.status_code == 201
        admin_token = res_admin.json()["access_token"]

        # --- PREPARATION: Create a Water Source ---
        source_payload = {
            "name": "Enugu Water Plant",
            "type": "TREATMENT_PLANT",
            "address": "123 Enugu Rd",
            "latitude": 6.44,
            "longitude": 7.50
        }
        res_src = await ac.post(
            "/api/v1/water-sources", 
            json=source_payload,
            headers={"Authorization": f"Bearer {facility_token}"}
        )
        assert res_src.status_code == 201
        source_id = res_src.json()["data"]["id"]

        # --- TEST 1: Role Restrictions on Tanker Registration ---
        tanker_payload = {
            "plate_number": "ENU-123-AA",
            "capacity_litres": 10000,
            "default_source_id": source_id,
            "license_documents": "https://example.com/license.pdf",
            "tanker_image": "https://example.com/tanker.jpg"
        }

        # Customer registers tanker -> should fail (403)
        res = await ac.post(
            "/api/v1/tankers", 
            json=tanker_payload,
            headers={"Authorization": f"Bearer {cust_token}"}
        )
        assert res.status_code == 403

        # Facility registers tanker -> should fail (403)
        res = await ac.post(
            "/api/v1/tankers", 
            json=tanker_payload,
            headers={"Authorization": f"Bearer {facility_token}"}
        )
        assert res.status_code == 403

        # Driver 1 registers tanker -> should succeed (201)
        res = await ac.post(
            "/api/v1/tankers", 
            json=tanker_payload,
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 201
        tanker_data = res.json()
        assert tanker_data["success"] is True
        tanker_id = tanker_data["data"]["id"]

        # --- TEST 2: Duplicate Registration & Plate Number ---
        
        # Driver 1 registers another tanker -> should fail (400)
        res_dup = await ac.post(
            "/api/v1/tankers", 
            json={
                "plate_number": "ENU-999-BB",
                "capacity_litres": 15000,
                "default_source_id": source_id,
                "license_documents": "https://example.com/license2.pdf",
                "tanker_image": "https://example.com/tanker2.jpg"
            },
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_dup.status_code == 400
        assert "already registered" in res_dup.json()["detail"]

        # Driver 2 registers a tanker with the same plate number -> should fail (400)
        res_plate_dup = await ac.post(
            "/api/v1/tankers", 
            json=tanker_payload,
            headers={"Authorization": f"Bearer {driver2_token}"}
        )
        assert res_plate_dup.status_code == 400
        assert "plate number is already registered" in res_plate_dup.json()["detail"]

        # --- TEST 3: Retrieve Tanker Details & /me ---
        
        # Get my tanker (Driver 1) -> success
        res_me = await ac.get(
            "/api/v1/tankers/me",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_me.status_code == 200
        me_data = res_me.json()
        assert me_data["success"] is True
        assert me_data["data"]["id"] == tanker_id
        assert me_data["data"]["status"] == "PENDING"
        assert me_data["data"]["is_eligible_for_drinking"] is False

        # Get my tanker (Driver 2 - no tanker registered) -> 404
        res_me2 = await ac.get(
            "/api/v1/tankers/me",
            headers={"Authorization": f"Bearer {driver2_token}"}
        )
        assert res_me2.status_code == 404

        # Get tanker details by ID -> success
        res_detail = await ac.get(f"/api/v1/tankers/{tanker_id}")
        assert res_detail.status_code == 200
        assert res_detail.json()["data"]["id"] == tanker_id

        # --- TEST 4: Admin Verification & Status Update ---
        
        # Non-admin updates tanker status -> fail (403)
        res_status_fail = await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "ACTIVE"},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_status_fail.status_code == 403

        # Admin updates tanker status with invalid value -> fail (422)
        res_status_invalid = await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "APPROVED"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_status_invalid.status_code == 422

        # Admin updates tanker status to ACTIVE -> success (200)
        res_status = await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "ACTIVE"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_status.status_code == 200
        assert res_status.json()["data"]["status"] == "ACTIVE"
        # At this point, the default water source is still verification_status = "PENDING"
        # So drinking eligibility should still be False
        assert res_status.json()["data"]["is_eligible_for_drinking"] is False

        # Verify all tankers list (Admin endpoint)
        res_list = await ac.get(
            "/api/v1/admin/tankers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_list.status_code == 200
        assert len(res_list.json()["data"]) >= 1

        # --- TEST 5: Verify Water Source and Check Eligibility Change ---
        
        # Verify water source
        res_verify_src = await ac.put(
            f"/api/v1/admin/water-sources/{source_id}/verify",
            json={"verification_status": "VERIFIED", "quality_grade": "A"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_verify_src.status_code == 200

        # Now check Driver 1's tanker details -> is_eligible_for_drinking should be True!
        res_detail_updated = await ac.get(f"/api/v1/tankers/{tanker_id}")
        assert res_detail_updated.status_code == 200
        assert res_detail_updated.json()["data"]["is_eligible_for_drinking"] is True
