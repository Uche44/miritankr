# docs/business-rules.md

## Core Business Rule

The platform guarantees water source traceability.

Every order must be linked to:

* Water Source
* Tanker
* Driver
* Customer

---

## Water Types

### DRINKING

Must originate from VERIFIED sources.

### UTILITY

May originate from VERIFIED or UNVERIFIED sources.

Examples:

* Construction
* Cleaning
* Agriculture
* Industrial

---

## Source Verification

Statuses:

```text
PENDING
VERIFIED
SUSPENDED
REJECTED
```

Only VERIFIED sources can fulfill drinking water orders.

---

## Tanker Eligibility

If tanker.default_source is VERIFIED:

Can receive:

```text
DRINKING
UTILITY
```

If tanker.default_source is not VERIFIED:

Can receive:

```text
UTILITY ONLY
```

---

## Order Statuses

```text
PENDING

ACCEPTED

GOING_TO_SOURCE

LOADING_WATER

EN_ROUTE

ARRIVED

DELIVERED

CANCELLED
```

Statuses are immutable events.

Do not skip states.

---

## Pricing Formula

Total Cost =

```text
Base Water Cost
+
Distance Cost
+
Urgency Fee
```

---

## Driver Assignment

Assignment Order:

1. Eligible Source
2. Eligible Tanker
3. Available Driver
4. Lowest ETA

---

## Auditability

The system must always answer:

* Who supplied the water?
* Where was it sourced?
* Who delivered it?
* When was it loaded?
* When was it delivered?

Historical records must never be deleted.
