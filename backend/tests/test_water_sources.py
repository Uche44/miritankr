import pytest
from httpx import AsyncClient
import uuid
from datetime import datetime

from app.main import app
from app.modules.water_sources.models import WaterSource
from app.modules.water_sources.service import water_source_service

@pytest.mark.asyncio
async def test_water_sources_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # --- PREPARATION: Create Test Users ---
        
        # 1. Register a Customer
        customer_reg = {
            "email": "customer_src@example.com",
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
            "email": "facility_src@example.com",
            "password": "password123",
            "first_name": "Tunde",
            "last_name": "Facility",
            "phone": "+2348022223333",
            "role": "FACILITY"
        }
        res_fac = await ac.post("/api/v1/auth/register", json=facility_reg)
        assert res_fac.status_code == 201
        facility_token = res_fac.json()["access_token"]

        # 3. Register an Admin
        admin_reg = {
            "email": "admin_src@example.com",
            "password": "password123",
            "first_name": "Ada",
            "last_name": "Admin",
            "phone": "+2348033334444",
            "role": "ADMIN"
        }
        res_admin = await ac.post("/api/v1/auth/register", json=admin_reg)
        assert res_admin.status_code == 201
        admin_token = res_admin.json()["access_token"]

        # --- TEST 1: Role Restrictions on Registration ---
        source_payload = {
            "name": "9th Mile Water Reservoir",
            "type": "RESERVOIR",
            "address": "9th Mile Corner, Ngwo, Enugu State",
            "latitude": 6.435,
            "longitude": 7.412
        }

        # Customer registers source -> should fail (403)
        res = await ac.post(
            "/api/v1/water-sources", 
            json=source_payload,
            headers={"Authorization": f"Bearer {cust_token}"}
        )
        assert res.status_code == 403

        # Facility registers source -> should succeed (201)
        res = await ac.post(
            "/api/v1/water-sources", 
            json=source_payload,
            headers={"Authorization": f"Bearer {facility_token}"}
        )
        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True
        assert data["data"]["name"] == "9th Mile Water Reservoir"
        assert data["data"]["verification_status"] == "PENDING"
        assert data["data"]["quality_grade"] is None
        source_id = data["data"]["id"]

        # --- TEST 2: Retrieve Sources List and Detail ---
        
        # Get List (public endpoint, no auth required)
        res_list = await ac.get("/api/v1/water-sources")
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert list_data["success"] is True
        assert len(list_data["data"]) >= 1
        assert any(s["id"] == source_id for s in list_data["data"])

        # Get Detail (public endpoint)
        res_detail = await ac.get(f"/api/v1/water-sources/{source_id}")
        assert res_detail.status_code == 200
        detail_data = res_detail.json()
        assert detail_data["success"] is True
        assert detail_data["data"]["id"] == source_id
        assert detail_data["data"]["location"]["address"] == source_payload["address"]
        assert detail_data["data"]["location"]["latitude"] == source_payload["latitude"]
        assert detail_data["data"]["quality_reports"] == []

        # Get Detail - Not Found
        res_detail_missing = await ac.get(f"/api/v1/water-sources/{uuid.uuid4()}")
        assert res_detail_missing.status_code == 404

        # --- TEST 3: Admin Verification & Quality Grade Rules ---
        
        verify_payload = {
            "verification_status": "VERIFIED",
            "quality_grade": "A"
        }

        # Non-admin tries to verify -> should fail (403)
        res_verify_fail = await ac.put(
            f"/api/v1/admin/water-sources/{source_id}/verify",
            json=verify_payload,
            headers={"Authorization": f"Bearer {facility_token}"}
        )
        assert res_verify_fail.status_code == 403

        # Admin tries to verify with invalid payload status -> should fail (422)
        res_verify_invalid = await ac.put(
            f"/api/v1/admin/water-sources/{source_id}/verify",
            json={"verification_status": "OKAY", "quality_grade": "Z"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_verify_invalid.status_code == 422

        # Admin verifies successfully -> should succeed (200)
        res_verify = await ac.put(
            f"/api/v1/admin/water-sources/{source_id}/verify",
            json=verify_payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_verify.status_code == 200
        verify_data = res_verify.json()
        assert verify_data["success"] is True
        assert verify_data["data"]["verification_status"] == "VERIFIED"
        assert verify_data["data"]["quality_grade"] == "A"
        assert verify_data["data"]["last_verified_at"] is not None

        # --- TEST 4: Service Eligibility Function Check ---
        # Mock class for checking eligibility
        unverified_source = WaterSource(verification_status="PENDING")
        verified_source = WaterSource(verification_status="VERIFIED")
        suspended_source = WaterSource(verification_status="SUSPENDED")
        rejected_source = WaterSource(verification_status="REJECTED")

        assert water_source_service.is_eligible_for_drinking(unverified_source) is False
        assert water_source_service.is_eligible_for_drinking(verified_source) is True
        assert water_source_service.is_eligible_for_drinking(suspended_source) is False
        assert water_source_service.is_eligible_for_drinking(rejected_source) is False
