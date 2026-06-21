# MiriTankr: Enugu State Water Supply Verification & Logistics Platform

MiriTankr is Enugu's first unified water logistics and provenance verification platform. It shifts the paradigm from a simple water-delivery utility to an open, trustworthy verification network connecting customers, tanker owners, drivers, and water source facilities.

---

## 🌊 The Problem in Enugu State, Nigeria
Enugu State faces a historical public water utility deficit, leading residential, commercial, and industrial consumers to rely heavily on private mobile water tankers. This informal marketplace introduces two critical challenges:
1. **The Trust Deficit (Water Safety)**: Customers order water blindly without knowing its origin. Tankers often source contaminated water from unverified boreholes, muddy rivers, or unsafe depots, mislabeling it as "clean treatment-plant water."
2. **Pricing Exploitation (Informal Cartels)**: During dry seasons or municipal disruptions, cartels and brokers double or triple water prices arbitrarily, leaving citizens to pay exorbitant fees with zero pricing transparency.

---

## 🛡️ The MiriTankr Core Solution

### 1. Water Provenance Tracking (Our Killer Feature)
MiriTankr operates as a digital ledger of clean water. Customers don't just order water—they order **verified water from a specific, audited source**. Every delivery generates a provenance log showing:
* The exact source name and address (e.g., *9th Mile Water Treatment Plant* vs *Community Borehole*).
* Quality indicators (inspection logs, pH levels, Total Dissolved Solids [TDS], turbidity) and quality grades (A, B, C).
* Fill timestamps, driver details, and real-time transit telemetry tracking to ensure no unapproved water replacement or siphoning.

### 2. Differentiated Water Categories
* **Drinking Water**: Strictly routed to certified, Class-A water treatment plants or municipal reservoirs. Only drivers with tankers registered to verified sources are eligible to accept these orders.
* **Utility Water**: Sourced from both verified and unverified boreholes for construction sites, pool-filling, cleaning, or industrial use, offering cost-effective pricing.

### 3. Regulated pricing
Smart matching algorithms eliminate surge extortion by informal syndicates through clear regulated pricing:
* **Controlled base price** per-litre, managed directly by the source facility.
* **Fixed transit rate** per-kilometer, computed dynamically based on GPS distance from the source to the customer's coordinates.
* Secure cashless transactions processed via **Paystack**.

---

## 👥 Platform Roles & Flow

```text
       Admin (Verifies Sources, Tankers & Quality Reports)
        │
        ├── Water Source Facility (Registers depots, updates quality reports)
        │     └── Tanker Owners & Drivers (Register vehicles, declare source, dispatch)
        │
        └── Customers (Request Water Category + Volume, Track Provenance & Pay)
```

1. **Admins**: Verify new source depots, review laboratory test metrics, and inspect tanker licenses.
2. **Water Source Facility**: Register physical depots, declare price per-litre, and log quality reports.
3. **Tanker Owners / Drivers**: Declare their primary water source, view active orders matching their source's eligibility, and receive turn-by-turn navigation routing.
4. **Customers**: Request water by category (Drinking/Utility) and size (500L to 50,000L). They track progress on a live map and pay upon successful delivery.

---

## 🛠️ Technology Stack

### Backend
* **Language & Framework**: Python 3.12, FastAPI (Async/Await)
* **Database & ORM**: PostgreSQL (Neon Cloud) / SQLite (Local), SQLAlchemy 2.0 (Asyncpg)
* **Migrations**: Alembic
* **Testing**: Pytest (100% test suite success)

### Frontend
* **Framework**: Next.js 16 (App Router, Turbopack, SSR & Client Hydration)
* **Styling**: Tailwind CSS v4, Lucide React Icons
* **Forms & Validation**: React Hook Form, Zod Resolver
* **State Management**: Zustand (Auth persist)
* **Payments**: Paystack checkout flow

---

## 🚀 Getting Started

### Local Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up the `.env` variables (see `.env.example`).
5. Run migrations and start the server:
   ```bash
   alembic upgrade head
   python create_admin.py --email admin@miritankr.com --password AdminPassword123 --first-name System --last-name Admin
   uvicorn app.main:app --reload
   ```

### Local Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd miritankr
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Visit the web app at `http://localhost:3000`.
