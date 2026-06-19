import pytest
from httpx import AsyncClient
import uuid

from app.main import app

@pytest.mark.asyncio
async def test_drivers_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # --- PREPARATION: Create Test Users ---
        
        # 1. Register a Driver (Driver 1)
        driver_reg = {
            "email": "driver_fleet@example.com",
            "password": "password123",
            "first_name": "Chinedu",
            "last_name": "Driver",
            "phone": "+2348044445555",
            "role": "DRIVER"
        }
        res_driver = await ac.post("/api/v1/auth/register", json=driver_reg)
        assert res_driver.status_code == 201
        driver_token = res_driver.json()["access_token"]

        # 2. Register an Admin
        admin_reg = {
            "email": "admin_fleet@example.com",
            "password": "password123",
            "first_name": "Ada",
            "last_name": "Admin",
            "phone": "+2348033334444",
            "role": "ADMIN"
        }
        res_admin = await ac.post("/api/v1/auth/register", json=admin_reg)
        assert res_admin.status_code == 201
        admin_token = res_admin.json()["access_token"]

        # 3. Register a Facility
        facility_reg = {
            "email": "facility_fleet@example.com",
            "password": "password123",
            "first_name": "Tunde",
            "last_name": "Facility",
            "phone": "+2348022223333",
            "role": "FACILITY"
        }
        res_fac = await ac.post("/api/v1/auth/register", json=facility_reg)
        assert res_fac.status_code == 201
        facility_token = res_fac.json()["access_token"]

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

        # --- TEST 1: Lazy Profile Creation & Retrieval ---
        
        # Get my profile as Driver
        res_me = await ac.get(
            "/api/v1/drivers/me",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_me.status_code == 200
        me_data = res_me.json()
        assert me_data["success"] is True
        assert me_data["data"]["status"] == "OFFLINE"
        assert me_data["data"]["tanker"] is None

        # --- TEST 2: Rejection of AVAILABLE without Tanker ---
        
        res_avail = await ac.put(
            "/api/v1/drivers/me/status",
            json={"status": "AVAILABLE"},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_avail.status_code == 400
        assert "Cannot set status to AVAILABLE without" in res_avail.json()["detail"]

        # --- TEST 3: Telemetry Location Updates ---
        
        res_loc = await ac.put(
            "/api/v1/drivers/me/location",
            json={"latitude": 6.4432, "longitude": 7.5011},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_loc.status_code == 200
        loc_data = res_loc.json()
        assert loc_data["success"] is True
        assert loc_data["data"]["latitude"] == 6.4432
        assert loc_data["data"]["longitude"] == 7.5011
        assert loc_data["data"]["last_location_update"] is not None

        # --- TEST 4: Tanker Assignment Rules ---
        
        # Register a tanker
        tanker_payload = {
            "plate_number": "ENU-777-BB",
            "capacity_litres": 12000,
            "default_source_id": source_id,
            "license_documents": "https://example.com/license.pdf",
            "tanker_image": "https://example.com/tanker.jpg"
        }
        res_tanker = await ac.post(
            "/api/v1/tankers",
            json=tanker_payload,
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_tanker.status_code == 201
        tanker_id = res_tanker.json()["data"]["id"]

        # Attempt to assign pending tanker -> fails (400)
        res_assign_fail = await ac.put(
            "/api/v1/drivers/me/tanker",
            json={"tanker_id": tanker_id},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_assign_fail.status_code == 400
        assert "It must be APPROVED and ACTIVE" in res_assign_fail.json()["detail"]

        # Admin approves tanker
        res_approve = await ac.put(
            f"/api/v1/admin/tankers/{tanker_id}/status",
            json={"status": "ACTIVE"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_approve.status_code == 200

        # Attempt to assign approved tanker -> succeeds (200)
        res_assign = await ac.put(
            "/api/v1/drivers/me/tanker",
            json={"tanker_id": tanker_id},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_assign.status_code == 200
        assert res_assign.json()["data"]["tanker_id"] == tanker_id

        # --- TEST 5: Status availability & Active Driver List ---
        
        # Set status to AVAILABLE -> succeeds now
        res_status = await ac.put(
            "/api/v1/drivers/me/status",
            json={"status": "AVAILABLE"},
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_status.status_code == 200
        assert res_status.json()["data"]["status"] == "AVAILABLE"

        # Check Active Drivers list
        from sqlalchemy import select
        from app.modules.auth.models import User as UserModel
        from app.modules.drivers.models import Driver as DriverModel
        from app.core.database import AsyncSessionLocal
        
        # Check Active Drivers list
        res_active = await ac.get("/api/v1/drivers/active")
        assert res_active.status_code == 200
        active_list = res_active.json()["data"]
        assert len(active_list) >= 1
        driver_in_list = [d for d in active_list if d["id"] == res_driver.json()["user"]["id"]][0]
        assert driver_in_list["status"] == "AVAILABLE"
        assert driver_in_list["latitude"] == 6.4432
        assert driver_in_list["tanker"]["plate_number"] == "ENU-777-BB"
        assert driver_in_list["tanker"]["capacity_litres"] == 12000
        assert driver_in_list["user"]["first_name"] == "Chinedu"

@pytest.mark.asyncio
async def test_driver_bank_account_workflow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Register a Driver
        driver_reg = {
            "email": "driver_bank@example.com",
            "password": "password123",
            "first_name": "BankDriver",
            "last_name": "Test",
            "phone": "+2348044445501",
            "role": "DRIVER"
        }
        res_driver = await ac.post("/api/v1/auth/register", json=driver_reg)
        assert res_driver.status_code == 201
        driver_token = res_driver.json()["access_token"]

        # 2. Get list of banks
        res_banks = await ac.get(
            "/api/v1/payments/banks",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_banks.status_code == 200
        banks = res_banks.json()["data"]
        assert len(banks) > 0
        assert "name" in banks[0]
        assert "code" in banks[0]

        # 3. Resolve account details (mock resolved)
        res_resolve = await ac.get(
            "/api/v1/payments/resolve-account?account_number=0001234567&bank_code=058",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_resolve.status_code == 200
        resolved = res_resolve.json()["data"]
        assert resolved["account_name"] == "MOCK VERIFIED ACCOUNT"

        # 4. Save bank account details
        bank_payload = {
            "bank_code": "058",
            "bank_name": "Guaranty Trust Bank",
            "account_number": "0001234567",
            "account_name": "MOCK VERIFIED ACCOUNT"
        }
        res_save = await ac.put(
            "/api/v1/drivers/me/bank-account",
            json=bank_payload,
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_save.status_code == 200
        saved_data = res_save.json()["data"]
        assert saved_data["bank_code"] == "058"
        assert saved_data["bank_name"] == "Guaranty Trust Bank"
        assert saved_data["account_number"] == "0001234567"
        assert saved_data["account_name"] == "MOCK VERIFIED ACCOUNT"

        # 5. Fetch profile again to verify persistence
        res_me = await ac.get(
            "/api/v1/drivers/me",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res_me.status_code == 200
        assert res_me.json()["data"]["bank_code"] == "058"

