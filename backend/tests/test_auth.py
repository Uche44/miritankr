import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_auth_flow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Register a new user
        register_payload = {
            "email": "customer@example.com",
            "password": "password123",
            "first_name": "Enugu",
            "last_name": "User",
            "phone": "+2348011112222",
            "role": "CUSTOMER"
        }
        res_register = await ac.post("/api/v1/auth/register", json=register_payload)
        assert res_register.status_code == 201
        data_register = res_register.json()
        assert "access_token" in data_register
        assert data_register["user"]["email"] == "customer@example.com"
        assert data_register["user"]["role"] == "CUSTOMER"

        # 2. Try registering the same email (should fail)
        res_duplicate = await ac.post("/api/v1/auth/register", json=register_payload)
        assert res_duplicate.status_code == 400
        assert "already exists" in res_duplicate.json()["detail"]

        # 3. Login with correct credentials
        login_payload = {
            "email": "customer@example.com",
            "password": "password123"
        }
        res_login = await ac.post("/api/v1/auth/login", json=login_payload)
        assert res_login.status_code == 200
        data_login = res_login.json()
        assert "access_token" in data_login
        token = data_login["access_token"]

        # 4. Login with incorrect credentials (should fail)
        invalid_login_payload = {
            "email": "customer@example.com",
            "password": "wrongpassword"
        }
        res_invalid_login = await ac.post("/api/v1/auth/login", json=invalid_login_payload)
        assert res_invalid_login.status_code == 401

        # 5. Access /me with Bearer token
        headers = {"Authorization": f"Bearer {token}"}
        res_me = await ac.get("/api/v1/auth/me", headers=headers)
        assert res_me.status_code == 200
        assert res_me.json()["email"] == "customer@example.com"

        # 6. Access /me without token (should fail)
        res_me_no_token = await ac.get("/api/v1/auth/me")
        assert res_me_no_token.status_code == 401
