This is the kind of `AGENTS.md` I would actually want AI coding agents and developers to follow. It focuses on architecture, scalability, traceability, and maintaining the trust layer that makes your water platform unique.

# Backend Architecture & System Design Guidelines

## Core Philosophy

This platform is not merely a water delivery application.

It is a water provenance, verification, and logistics platform.

Every architectural decision must prioritize:

1. Traceability
2. Reliability
3. Security
4. Scalability
5. Maintainability

The system must always be capable of answering:

* Where did the water come from?
* Was the source verified?
* Which tanker delivered it?
* Who approved the source?
* When was the water loaded?
* When was it delivered?

---

# Architecture Principles

## 1. Separation of Concerns

Business logic must never exist inside route handlers.

Routes should:

* Validate requests
* Call services
* Return responses

Services should:

* Implement business rules
* Coordinate repositories
* Trigger domain events

Repositories should:

* Handle database access only

Example:

```text
API Route
    ↓
Service Layer
    ↓
Repository Layer
    ↓
Database
```

---

## 2. Modular Domain Design

Organize by business domains.

Preferred:

```text
app/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── orders/
│   ├── tankers/
│   ├── tracking/
│   ├── water_sources/
│   ├── quality_reports/
│   ├── payments/
│   ├── notifications/
│   └── admin/
```

Avoid large shared service folders that become dumping grounds.

---

## 3. API Versioning

All endpoints must be versioned.

Example:

```text
/api/v1/auth
/api/v1/orders
/api/v1/tankers
```

Never expose unversioned APIs.

Future changes must not break existing clients.

---

## 4. Domain Ownership

Every module owns:

```text
controller
service
repository
schemas
models
tests
```

Cross-module access should occur through service interfaces.

Avoid direct repository access across domains.

---

# Authentication & Authorization

## Authentication

Use:

```text
JWT Access Token
Refresh Token
```

Passwords must be hashed using modern secure algorithms.

Never store plaintext passwords.

---

## Authorization

Use Role-Based Access Control (RBAC).

Roles:

```text
CUSTOMER

DRIVER

FACILITY

ADMIN
```

Never authorize based on email addresses.

Bad:

```python
if user.email == "admin@example.com"
```

Good:

```python
require_role("ADMIN")
```

---

## Permission-Based Growth

Design authorization so that future permissions can be added.

Examples:

```text
can_manage_sources

can_verify_sources

can_assign_tankers

can_view_reports
```

---

# Domain Models

## User

Represents all authenticated actors.

Fields:

```text
id
email
phone
role
is_active
created_at
```

---

## WaterSource

Represents a physical source of water.

Examples:

* Borehole
* Treatment Plant
* Reservoir
* Government Facility

Fields:

```text
id
name
type
location
verification_status
quality_grade
last_verified_at
```

---

## Tanker

Represents a delivery vehicle.

Fields:

```text
id
owner_id
capacity
default_source_id
status
```

---

## Order

Represents a water request.

Fields:

```text
id
customer_id
water_type
quantity
status
assigned_tanker_id
source_id
```

---

## TrackingEvent

Represents delivery progress.

Fields:

```text
id
order_id
event_type
timestamp
metadata
```

---

# Water Source Verification Rules

Verified water sources may supply:

```text
DRINKING_WATER
UTILITY_WATER
```

Unverified sources may supply:

```text
UTILITY_WATER_ONLY
```

System must enforce this rule automatically.

No manual bypasses.

---

# Event-Driven Design

Orders should be represented as a sequence of events.

Examples:

```text
ORDER_CREATED

ORDER_ACCEPTED

TANKER_ASSIGNED

GOING_TO_SOURCE

WATER_LOADED

EN_ROUTE

ARRIVED

DELIVERED

CANCELLED
```

Events are immutable.

Never overwrite history.

---

# Traceability Requirements

Every completed order must retain:

```text
customer

driver

tanker

water source

load timestamp

delivery timestamp
```

The system must always support full delivery reconstruction.

---

# Database Design

## PostgreSQL

PostgreSQL is the system of record.

All critical business data must reside in PostgreSQL.

---

## UUIDs

Use UUIDs for public-facing entities.

Avoid incremental integer identifiers.

---

## Foreign Keys

Use database constraints.

Example:

```text
orders.source_id
→ water_sources.id
```

Do not rely solely on application-level validation.

---

## Soft Deletes

Critical entities must support soft deletion.

Examples:

```text
users

water_sources

tankers
```

Use:

```text
deleted_at
```

instead of hard deletes.

---

## Migrations

All schema changes must occur through migrations.

Never modify production schemas manually.

---

# Service Layer Rules

Services contain business logic.

Examples:

```text
OrderService

WaterSourceService

TrackingService

PaymentService
```

Services must be reusable.

Avoid duplicating business rules.

---

# Repository Rules

Repositories:

* Read data
* Write data
* Execute queries

Repositories must never contain business decisions.

---

# Real-Time Tracking

Real-time communication should use WebSockets.

Use cases:

```text
driver location updates

order status updates

live delivery tracking
```

Tracking data should be separated from normal REST requests.

---

# Background Jobs

Long-running tasks must run asynchronously.

Examples:

```text
notifications

emails

sms

payment reconciliation

report generation
```

Never block API requests waiting for these operations.

---

# Payment Rules

Payments must be idempotent.

Repeated requests must not create duplicate charges.

Every payment transaction must have:

```text
reference

status

provider

timestamp
```

---

# Logging

Log:

* Requests
* Errors
* Domain events
* Payment events

Never log:

* Passwords
* Tokens
* Sensitive user data

---

# Error Handling

Use consistent error responses.

Example:

```json
{
  "success": false,
  "message": "Water source not verified",
  "code": "SOURCE_NOT_VERIFIED"
}
```

Avoid inconsistent error formats.

---

# Testing Requirements

Every module should include:

* Unit tests
* Service tests
* Repository tests

Critical flows require integration tests.

Examples:

```text
order creation

payment processing

tanker assignment

source verification
```

---

# Security Principles

Never trust client input.

Validate all requests.

Use rate limiting for:

```text
authentication

password reset

verification endpoints
```

Sanitize all user-generated content.

---

# Observability

Monitor:

```text
orders created

orders completed

delivery time

payment success rate

source verification activity
```

The platform should be measurable and auditable.

---

# Non-Negotiables

* No business logic in controllers.
* No direct database access outside repositories.
* No hardcoded roles.
* No hardcoded configuration values.
* No unversioned APIs.
* No plaintext passwords.
* No bypassing source verification rules.
* No overwriting tracking history.
* No deletion of audit records.

Water source traceability is a core platform guarantee and must never be compromised.

One thing I'd add beyond the document: define your **order assignment strategy** as a first-class system rule from day one:

```text
Customer Creates Order
        ↓
Filter Eligible Sources
        ↓
Filter Eligible Tankers
        ↓
Sort By Distance
        ↓
Sort By Availability
        ↓
Assign Tanker
```

That matching engine is effectively the "Uber algorithm" of your platform and will become one of the most important backend services as the product evolves.
