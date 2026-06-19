import asyncio
import sys
import os
import argparse
import getpass

# Add current directory to path so that 'app' can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.modules.auth.models import User
from app.core.security import get_password_hash
from sqlalchemy import select

async def create_admin(email, password, first_name, last_name, phone):
    async with AsyncSessionLocal() as db:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == email))
        existing_user = result.scalars().first()
        if existing_user:
            print(f"Error: User with email '{email}' already exists.")
            return False

        hashed_pwd = get_password_hash(password)
        new_admin = User(
            email=email,
            hashed_password=hashed_pwd,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            role="ADMIN",
            is_active=True
        )
        db.add(new_admin)
        await db.commit()
        print(f"Success: Admin user '{email}' created successfully.")
        return True

def main():
    parser = argparse.ArgumentParser(description="Create an admin user for MiriTankr backend.")
    parser.add_argument("--email", help="Admin user email address")
    parser.add_argument("--password", help="Admin user password")
    parser.add_argument("--first-name", default="Admin", help="First name (default: Admin)")
    parser.add_argument("--last-name", default="User", help="Last name (default: User)")
    parser.add_argument("--phone", default="+2348000000000", help="Phone number (default: +2348000000000)")

    args = parser.parse_args()

    email = args.email
    password = args.password

    # Prompt if not provided via arguments
    if not email:
        email = input("Enter Admin Email: ").strip()
    if not password:
        password = getpass.getpass("Enter Admin Password: ").strip()

    if not email or not password:
        print("Error: Email and password are required.")
        sys.exit(1)

    asyncio.run(create_admin(
        email=email,
        password=password,
        first_name=args.first_name,
        last_name=args.last_name,
        phone=args.phone
    ))

if __name__ == "__main__":
    main()
