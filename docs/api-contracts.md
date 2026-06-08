# docs/api-contracts.md

## API Standards

Base URL:

```text
/api/v1
```

All responses must follow the same envelope.

Success:

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Water source not verified",
  "code": "SOURCE_NOT_VERIFIED"
}
```

---

# Authentication

Authentication uses JWT Bearer tokens.

Header:

```http
Authorization: Bearer <token>
```

---

# User Roles

```text
CUSTOMER
DRIVER
FACILITY
ADMIN
```

---

# Auth Endpoints

## Register

POST /auth/register

Request:

```json
{
  "email": "john@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+2348012345678",
  "role": "CUSTOMER"
}
```

Response:

```json
{
  "success": true,
  "message": "Account created",
  "data": {
    "user": {},
    "access_token": "",
    "refresh_token": ""
  }
}
```

---

## Login

POST /auth/login

Request:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {},
    "access_token": "",
    "refresh_token": ""
  }
}
```

---

# Water Sources

## Get Sources

GET /water-sources

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "New Artisan Borehole",
      "type": "BOREHOLE",
      "verification_status": "VERIFIED",
      "quality_grade": "A",
      "address": "",
      "latitude": 0,
      "longitude": 0,
      "last_verified_at": ""
    }
  ]
}
```

---

## Get Source Details

GET /water-sources/{id}

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "",
    "verification_status": "VERIFIED",
    "quality_reports": [],
    "location": {}
  }
}
```

---

# Orders

## Create Order

POST /orders

Request:

```json
{
  "water_type": "DRINKING",
  "quantity_litres": 10000,
  "delivery_address": "New Haven Enugu",
  "latitude": 0,
  "longitude": 0,
  "scheduled_at": null
}
```

Response:

```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "order_id": "uuid",
    "status": "PENDING"
  }
}
```

---

## Get Orders

GET /orders

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "EN_ROUTE",
      "water_type": "DRINKING",
      "quantity_litres": 10000
    }
  ]
}
```

---

## Get Order Details

GET /orders/{id}

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "EN_ROUTE",
    "water_source": {},
    "assigned_tanker": {},
    "tracking_timeline": []
  }
}
```

---

# Tracking

## Get Live Tracking

GET /orders/{id}/tracking

Response:

```json
{
  "success": true,
  "data": {
    "driver_location": {
      "latitude": 0,
      "longitude": 0
    },
    "source_location": {},
    "estimated_arrival_minutes": 15
  }
}
```

---

## Add Tracking Event

POST /tracking-events

Request:

```json
{
  "order_id": "uuid",
  "event_type": "WATER_LOADED",
  "metadata": {}
}
```

Response:

```json
{
  "success": true
}
```

---

# Tankers

## Register Tanker

POST /tankers

Request:

```json
{
  "plate_number": "",
  "capacity_litres": 10000,
  "default_source_id": "uuid"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid"
  }
}
```

---

# Quality Reports

GET /water-sources/{id}/quality-reports

Response:

```json
{
  "success": true,
  "data": [
    {
      "tested_at": "",
      "ph": 7.1,
      "tds": 50,
      "grade": "A"
    }
  ]
}
```

---

# Payments

POST /payments/initialize

Request:

```json
{
  "order_id": "uuid"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "checkout_url": ""
  }
}
```

---

# WebSocket Events

## Driver Location Updated

```json
{
  "event": "DRIVER_LOCATION_UPDATED",
  "data": {
    "order_id": "",
    "latitude": 0,
    "longitude": 0
  }
}
```

---

## Order Status Changed

```json
{
  "event": "ORDER_STATUS_CHANGED",
  "data": {
    "order_id": "",
    "status": "EN_ROUTE"
  }
}
```
