import pytest
from httpx import AsyncClient
import uuid
from datetime import datetime, timedelta

from app.main import app

@pytest.mark.asyncio
async def test_quality_reports_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # --- PREPARATION: Create Test Users ---
        
        # 1. Register a Customer
        customer_reg = {
            "email": "customer_qr@example.com",
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
            "email": "facility_qr@example.com",
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
            "email": "admin_qr@example.com",
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
            "name": "9th Mile Quality Source",
            "type": "RESERVOIR",
            "address": "9th Mile, Enugu State",
            "latitude": 6.435,
            "longitude": 7.412
        }
        res_source = await ac.post(
            "/api/v1/water-sources",
            json=source_payload,
            headers={"Authorization": f"Bearer {facility_token}"}
        )
        assert res_source.status_code == 201
        source_id = res_source.json()["data"]["id"]

        # Verify that initially, grade is None
        assert res_source.json()["data"]["quality_grade"] is None

        # --- TEST 1: Role restrictions on submitting quality report ---
        report_payload = {
            "tested_at": datetime.utcnow().isoformat(),
            "ph": 7.2,
            "tds": 150.0,
            "turbidity": 1.5,
            "grade": "A"
        }

        # Customer tries to submit report -> 403 Forbidden
        res_submit_cust = await ac.post(
            f"/api/v1/water-sources/{source_id}/quality-reports",
            json=report_payload,
            headers={"Authorization": f"Bearer {cust_token}"}
        )
        assert res_submit_cust.status_code == 403

        # Facility user submits report -> 201 Created
        res_submit_fac = await ac.post(
            f"/api/v1/water-sources/{source_id}/quality-reports",
            json=report_payload,
            headers={"Authorization": f"Bearer {facility_token}"}
        )
        assert res_submit_fac.status_code == 201
        report_data = res_submit_fac.json()
        assert report_data["success"] is True
        assert report_data["data"]["ph"] == 7.2
        assert report_data["data"]["grade"] == "A"
        report_id_1 = report_data["data"]["id"]

        # Verify that submitting report updated the water source grade to 'A'
        res_detail = await ac.get(f"/api/v1/water-sources/{source_id}")
        assert res_detail.status_code == 200
        assert res_detail.json()["data"]["quality_grade"] == "A"
        # The detail endpoint should return our new report
        assert len(res_detail.json()["data"]["quality_reports"]) == 1
        assert res_detail.json()["data"]["quality_reports"][0]["id"] == report_id_1

        # --- TEST 2: Submit another report (Admin) and check sorting ---
        # Submit a second report with a newer tested_at timestamp and different grade
        newer_time = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        report_payload_admin = {
            "tested_at": newer_time,
            "ph": 6.8,
            "tds": 180.0,
            "turbidity": 2.1,
            "grade": "B"
        }

        res_submit_admin = await ac.post(
            f"/api/v1/water-sources/{source_id}/quality-reports",
            json=report_payload_admin,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_submit_admin.status_code == 201
        report_id_2 = res_submit_admin.json()["data"]["id"]

        # The water source's grade should now be updated to B
        res_detail_updated = await ac.get(f"/api/v1/water-sources/{source_id}")
        assert res_detail_updated.status_code == 200
        assert res_detail_updated.json()["data"]["quality_grade"] == "B"

        # List reports for source -> public endpoint, no auth required
        res_list = await ac.get(f"/api/v1/water-sources/{source_id}/quality-reports")
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert list_data["success"] is True
        assert len(list_data["data"]) == 2
        # Check sorting: newest tested_at first
        assert list_data["data"][0]["id"] == report_id_2
        assert list_data["data"][1]["id"] == report_id_1

        # --- TEST 3: Report Detail endpoint ---
        # Detail of first report
        res_report_detail = await ac.get(f"/api/v1/water-sources/{source_id}/quality-reports/{report_id_1}")
        assert res_report_detail.status_code == 200
        assert res_report_detail.json()["data"]["id"] == report_id_1
        assert res_report_detail.json()["data"]["grade"] == "A"

        # Detail of second report
        res_report_detail2 = await ac.get(f"/api/v1/water-sources/{source_id}/quality-reports/{report_id_2}")
        assert res_report_detail2.status_code == 200
        assert res_report_detail2.json()["data"]["id"] == report_id_2
        assert res_report_detail2.json()["data"]["grade"] == "B"

        # Report detail with mismatching source_id should return 404
        dummy_source_id = uuid.uuid4()
        res_mismatch_source = await ac.get(f"/api/v1/water-sources/{dummy_source_id}/quality-reports/{report_id_1}")
        assert res_mismatch_source.status_code == 404

        # --- TEST 4: 404 errors ---
        # Submitting to non-existent source
        res_submit_nonexistent = await ac.post(
            f"/api/v1/water-sources/{dummy_source_id}/quality-reports",
            json=report_payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_submit_nonexistent.status_code == 404

        # Listing for non-existent source
        res_list_nonexistent = await ac.get(f"/api/v1/water-sources/{dummy_source_id}/quality-reports")
        assert res_list_nonexistent.status_code == 404

        # Non-existent report detail
        res_detail_nonexistent = await ac.get(f"/api/v1/water-sources/{source_id}/quality-reports/{uuid.uuid4()}")
        assert res_detail_nonexistent.status_code == 404
