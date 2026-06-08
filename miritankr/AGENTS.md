<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

For an `AGENTS.md`, don't write generic React advice. Write rules that force consistency as the codebase grows.

I'd include something like this:

# Frontend Architecture & Development Guidelines

## Core Principles

### 1. Feature-First Architecture

Organize code by business domain, not technical type.

Preferred:

```text
src/
├── features/
│   ├── auth/
│   ├── orders/
│   ├── tracking/
│   ├── tankers/
│   ├── water-sources/
│   ├── payments/
│   └── profile/
```

Avoid:

```text
components/
hooks/
pages/
services/
```

as top-level dumping grounds.

---

### 2. Separation of Responsibilities

Components render UI.

Hooks manage UI behavior.

Services communicate with APIs.

Stores manage client state.

Components must never directly contain API logic.

Bad:

```tsx
const res = await fetch(...)
```

inside components.

Good:

```tsx
const { data } = useOrders()
```

---

### 3. Server State vs Client State

Use TanStack Query for server state.

Examples:

* Orders
* Water Sources
* Tankers
* Tracking Data
* Payments

Use Zustand for client state.

Examples:

* Auth session
* Current order draft
* Modal state
* Theme
* UI preferences

Do not duplicate TanStack Query data inside Zustand.

---

### 4. Reusable UI System

Build primitives first.

Examples:

```text
Button
Input
Card
Badge
Dialog
Select
```

Feature components should compose primitives.

Examples:

```text
OrderCard
SourceCard
TankerCard
TrackingTimeline
```

---

### 5. Mobile-First Design

All interfaces must be designed for mobile before desktop.

Reason:

Primary users include:

* Homeowners
* Tanker Drivers
* Water Suppliers

Most usage will occur on mobile devices.

---

### 6. Accessibility

All forms must:

* Have labels
* Support keyboard navigation
* Display validation errors
* Use semantic HTML

Never rely on color alone to convey status.

---

### 7. Loading & Error States

Every API request must handle:

* Loading
* Success
* Error
* Empty State

Never leave users staring at blank screens.

---

### 8. Type Safety

Use TypeScript strictly.

Never use:

```ts
any
```

unless unavoidable.

Generate shared types from backend schemas when possible.

---

### 9. Predictable Component Design

Components should be:

* Small
* Reusable
* Testable

Avoid components exceeding 300 lines.

Extract logic into hooks.

---

### 10. Consistent Naming

Components:

```text
PascalCase
```

Hooks:

```text
useCamelCase
```

Files:

```text
kebab-case.ts
```

Types:

```text
PascalCase
```

Constants:

```text
UPPER_SNAKE_CASE
```

---

## Folder Structure

```text
src/
├── app/
├── features/
├── components/
│   ├── ui/
│   └── shared/
├── services/
├── hooks/
├── stores/
├── lib/
├── types/
├── constants/
├── providers/
└── styles/
```

---

## API Layer Rules

All backend communication must pass through service modules.

Example:

```text
services/
├── auth.service.ts
├── order.service.ts
├── tanker.service.ts
├── source.service.ts
```

Components must never call fetch directly.

---

## Real-Time Tracking Rules

Tracking data must be isolated from normal API state.

Sources:

* WebSocket events
* Live driver locations
* Order status updates

Do not store live tracking inside page-level state.

Use dedicated tracking hooks and stores.

---

## Forms

Use:

* React Hook Form
* Zod

All forms must have schema validation.

Never rely solely on backend validation.

---

## Authentication

Authentication state must be centralized.

Store:

```text
user
token
role
permissions
```

inside a dedicated auth store.

Never duplicate auth state.

---

## Performance

Use:

```text
Lazy loading
Code splitting
Route-based chunking
```

Avoid unnecessary re-renders.

Memoize expensive computations.

---

## Security

Never expose:

* API secrets
* Service keys
* Internal identifiers

Validate all user input before submission.

Escape user-generated content where necessary.

---

## User Experience Principles

The platform must optimize for:

1. Trust
2. Transparency
3. Reliability
4. Speed

Users should always know:

* Where their water comes from
* Which tanker is assigned
* Current delivery status
* Estimated arrival time

Water source traceability is a core product feature and must remain visible throughout the order lifecycle.

A few additional sections I'd add that most teams forget:

### Design System Rules

* Use an 8px spacing system.
* Limit the color palette.
* Use status colors consistently:

  * Green = Verified/Delivered
  * Yellow = Pending
  * Red = Rejected/Failed
  * Blue = In Progress

### Domain Vocabulary

Force everyone to use the same terms:

```text
Water Source
Verified Source
Tanker
Driver
Order
Delivery
Water Quality Report
Tracking Event
```

Never mix terms like:

```text
Vendor
Supplier
Provider
Merchant
```

for the same entity.

### Order State Machine

Define it once:

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

Every frontend screen should respect these states.

### Frontend Non-Negotiables

* No direct fetch calls in components.
* No `any`.
* No business logic in UI components.
* No duplicated API types.
* No hardcoded URLs.
* No direct localStorage access outside dedicated utilities.
* No role checks scattered across components.

Create centralized helpers:

```ts
canManageSources(user)
canAcceptOrders(user)
canViewAdminDashboard(user)
```

instead of:

```ts
user.role === "ADMIN"
```

everywhere.

Those rules will save you months of technical debt once the platform grows beyond the hackathon MVP.

<!-- END:nextjs-agent-rules -->
