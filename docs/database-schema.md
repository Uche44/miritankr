# docs/database-schema.md

This document details the database schema for the MiriTankr platform. We use **UUIDs** for all primary keys, support **Soft Deletes** (using `deleted_at`) for core entities, and enforce relational constraints.

---

## Entity Relationship Diagram

```text
  ┌───────────┐         ┌───────────┐         ┌───────────────┐
  │   users   │◀────────│  tankers  │◀────────│    drivers    │
  └───────────┘         └───────────┘         └───────────────┘
        ▲                     │                       ▲
        │                     ▼                       │
        │               ┌───────────┐                 │
        │               │   water   │                 │
        └───────────────│  sources  │                 │
                        └───────────┘                 │
                              ▲                       │
                              │                       │
                        ┌───────────┐                 │
                        │  quality  │                 │
                        │  reports  │                 │
                        └───────────┘                 │
                                                      │
  ┌───────────┐         ┌───────────┐                 │
  │  orders   │◀────────│ tracking  │                 │
  └───────────┘         │  events   │                 │
        │               └───────────┘                 │
        ├─────────────────────────────────────────────┘
        ▼
  ┌───────────┐
  │ payments  │
  └───────────┘
```

---

## Table Schemas

### 1. `users`
Represents all system actors (Customers, Drivers, Tanker Owners, Admins).

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Unique user identifier |
| `email` | VARCHAR(255) | Unique, Indexed, NOT NULL | Authentication email address |
| `hashed_password` | VARCHAR(255) | NOT NULL | Hashed password |
| `first_name` | VARCHAR(100) | NOT NULL | User's first name |
| `last_name` | VARCHAR(100) | NOT NULL | User's last name |
| `phone` | VARCHAR(20) | NOT NULL | Phone number (for SMS/calls) |
| `role` | VARCHAR(50) | NOT NULL | One of: `CUSTOMER`, `DRIVER`, `FACILITY`, `ADMIN` |
| `is_active` | BOOLEAN | DEFAULT TRUE | Active status check |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `deleted_at` | TIMESTAMP | Nullable | Soft delete timestamp |

---

### 2. `water_sources`
Represents physical water source depots in Enugu State.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Unique source identifier |
| `name` | VARCHAR(255) | NOT NULL | Source name (e.g. "9th Mile Reservoir") |
| `type` | VARCHAR(50) | NOT NULL | One of: `BOREHOLE`, `TREATMENT_PLANT`, `RESERVOIR`, `GOVERNMENT_FACILITY`, `COMMERCIAL_VENDOR` |
| `verification_status` | VARCHAR(50) | DEFAULT 'PENDING' | One of: `PENDING`, `VERIFIED`, `SUSPENDED`, `REJECTED` |
| `quality_grade` | VARCHAR(5) | Nullable | Water grade (e.g. `A`, `B`, `C`, `D`) |
| `address` | TEXT | NOT NULL | Description of the physical location |
| `latitude` | DOUBLE PRECISION | NOT NULL | GPS Latitude |
| `longitude` | DOUBLE PRECISION | NOT NULL | GPS Longitude |
| `owner_id` | UUID | Foreign Key -> `users.id`, Nullable | Owner of the borehole/source if registered |
| `last_verified_at` | TIMESTAMP | Nullable | When the source was verified |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `deleted_at` | TIMESTAMP | Nullable | Soft delete timestamp |

---

### 3. `tankers`
Represents the delivery vehicles.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Unique tanker identifier |
| `owner_id` | UUID | Foreign Key -> `users.id`, NOT NULL | Owner (must have `DRIVER` or `ADMIN` role) |
| `plate_number` | VARCHAR(50) | Unique, NOT NULL | Vehicle license plate |
| `capacity_litres` | INTEGER | NOT NULL | Water capacity (e.g. 10000) |
| `default_source_id` | UUID | Foreign Key -> `water_sources.id`, Nullable | Default source for filling |
| `license_documents` | VARCHAR(255) | NOT NULL | Mock vehicle/license registration document url/text |
| `tanker_image` | VARCHAR(255) | NOT NULL | Vehicle photo url/text |
| `status` | VARCHAR(50) | DEFAULT 'ACTIVE' | One of: `ACTIVE`, `OUT_OF_SERVICE` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `deleted_at` | TIMESTAMP | Nullable | Soft delete timestamp |

---

### 4. `drivers`
Extends driver users with tanker mapping and live telemetry status.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key, Foreign Key -> `users.id` | Driver's user identifier |
| `tanker_id` | UUID | Foreign Key -> `tankers.id`, Nullable | Currently assigned vehicle |
| `status` | VARCHAR(50) | DEFAULT 'OFFLINE' | One of: `AVAILABLE`, `OFFLINE`, `BUSY` |
| `latitude` | DOUBLE PRECISION | Nullable | Live GPS Latitude |
| `longitude` | DOUBLE PRECISION | Nullable | Live GPS Longitude |
| `last_location_update` | TIMESTAMP | Nullable | GPS update timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

---

### 5. `orders`
Represents customer requests for water tankers.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Unique order identifier |
| `customer_id` | UUID | Foreign Key -> `users.id`, NOT NULL | Customer placing the order |
| `water_type` | VARCHAR(50) | NOT NULL | One of: `DRINKING`, `UTILITY` |
| `quantity_litres` | INTEGER | NOT NULL | Requested volume |
| `delivery_address` | TEXT | NOT NULL | Physical address for delivery |
| `latitude` | DOUBLE PRECISION | NOT NULL | GPS Latitude of destination |
| `longitude` | DOUBLE PRECISION | NOT NULL | GPS Longitude of destination |
| `scheduled_at` | TIMESTAMP | Nullable | Null for immediate, datetime for scheduled |
| `status` | VARCHAR(50) | DEFAULT 'PENDING' | One of: `PENDING`, `ACCEPTED`, `GOING_TO_SOURCE`, `LOADING_WATER`, `EN_ROUTE`, `ARRIVED`, `DELIVERED`, `CANCELLED` |
| `assigned_tanker_id` | UUID | Foreign Key -> `tankers.id`, Nullable | Tanker assigned to deliver |
| `assigned_driver_id` | UUID | Foreign Key -> `users.id`, Nullable | Driver executing delivery |
| `source_id` | UUID | Foreign Key -> `water_sources.id`, Nullable | Actual source water was filled from |
| `price` | DECIMAL(10, 2) | NOT NULL | Locked quote cost in NGN (Nigerian Naira) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Order creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last status modification timestamp |

---

### 6. `tracking_events`
Audit log storing the event-based timeline of order deliveries.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Event identifier |
| `order_id` | UUID | Foreign Key -> `orders.id`, NOT NULL | Associated order |
| `event_type` | VARCHAR(100) | NOT NULL | Event tag (e.g. `WATER_LOADED`, `EN_ROUTE`) |
| `timestamp` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the status change occurred |
| `latitude` | DOUBLE PRECISION | Nullable | Telemetry coordinates during event |
| `longitude` | DOUBLE PRECISION | Nullable | Telemetry coordinates during event |
| `metadata` | JSONB | Nullable | Custom JSON payload for extra variables |

---

### 7. `water_quality_reports`
Stores water purity and safety checkpoints for sources.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Report identifier |
| `source_id` | UUID | Foreign Key -> `water_sources.id`, NOT NULL | Target water source |
| `tested_at` | TIMESTAMP | NOT NULL | Quality test date |
| `ph` | DOUBLE PRECISION | NOT NULL | pH acidity check (ideal: 6.5 - 8.5) |
| `tds` | DOUBLE PRECISION | NOT NULL | Total Dissolved Solids level (mg/L) |
| `turbidity` | DOUBLE PRECISION | NOT NULL | Water clarity (NTU) |
| `grade` | VARCHAR(5) | NOT NULL | Assessed grade (e.g., `A`, `B`) |
| `inspector_id` | UUID | Foreign Key -> `users.id`, NOT NULL | Admin/Inspector user |

---

### 8. `payments`
Details payment statuses and transactions.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Transaction identifier |
| `order_id` | UUID | Foreign Key -> `orders.id`, NOT NULL | Target order |
| `reference` | VARCHAR(255) | Unique, NOT NULL | Idempotency transaction reference |
| `amount` | DECIMAL(10, 2) | NOT NULL | Payment amount |
| `status` | VARCHAR(50) | NOT NULL | One of: `PENDING`, `SUCCESSFUL`, `FAILED` |
| `provider` | VARCHAR(100) | NOT NULL | Gate provider (e.g., "Paystack Mock") |
| `timestamp` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Payment transaction datetime |
