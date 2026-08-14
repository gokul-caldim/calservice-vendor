# Marketplace ↔ Workforce Operational Contract & Field Ownership

This document defines the strict operational contract and field ownership boundaries between the **Marketplace System** and the **Workforce Management Engine** for the shared `ServiceRequest` model (`service_requests_servicerequest`).

---

## 1. Shared Model & Field Ownership Boundaries

| Field Name | Data Type | Owner | Read/Write Rules & Constraints |
| :--- | :--- | :--- | :--- |
| `id` / `request_id` | Integer / String | Marketplace | Created by Marketplace (`SR-XXXX`); Read-only for Workforce |
| `customer` | ForeignKey(User) | Marketplace | Owned by Marketplace; Workforce must not overwrite |
| `customer_name` | String | Marketplace | Owned by Marketplace |
| `phone` / `email` | String | Marketplace | Owned by Marketplace |
| `service_category` | String | Marketplace | Owned by Marketplace |
| `issue_title` / `description` | String | Marketplace | Owned by Marketplace |
| `address` / `drop_address` | String | Marketplace | Owned by Marketplace |
| `total_amount` | Decimal | Marketplace | Set by Marketplace booking; Workforce appends parts extensions via `cart_data` |
| `payment_method` | Enum | Marketplace | `COD` / `ONLINE`; Set during booking creation |
| `payment_status` | Enum | Shared | Marketplace sets initial (`pending`); Workforce updates to `collected` on Cash Collection (COD) |
| `assigned_employee` | ForeignKey(Employee) | Workforce | **Strictly owned by Workforce Engine** (set during offer acceptance/dispatch) |
| `status` | Enum | Shared State Machine | Created as `new_request`/`confirmed`; Workforce executes operational transitions (`assigned` → `accepted` → `on_the_way` → `in_progress` → `completed`) |
| `cart_data` | JSONB | Shared | Marketplace stores cart items; Workforce appends proof-of-work photos, completion notes, and cash collection receipts |

---

## 2. End-to-End Operational Lifecycle & Status Workflow

```text
Marketplace Booking Created (status = 'new_request')
       ↓
[Automatic Dispatch Signal Trigger]
       ↓
run_automatic_dispatch() → WorkforceJobOffer (status = 'OFFERED', expires_at = +5 min)
       ↓
Technician Accepts Offer → ServiceRequest (status = 'accepted', assigned_employee = emp)
       ↓
Technician En Route → ServiceRequest (status = 'on_the_way')
       ↓
Technician Work Execution → ServiceRequest (status = 'in_progress')
       ↓
Proof Photo Submission & Cash Collection → ServiceRequest (payment_status = 'collected')
       ↓
Job Completion → ServiceRequest (status = 'completed')
       ↓
Marketplace Reads Final Status & Financial Settlement
```

---

## 3. Allowed Update Rules & Validation Safeguards

1. **Duplicate Booking Prevention:** Workforce never creates duplicate `ServiceRequest` rows. The shared `ServiceRequest` ID is the single canonical reference across Marketplace and Workforce.
2. **Workforce Mutation Safeguards:** Workforce API write handlers inspect target attributes prior to saving and explicitly reject any attempt to modify Marketplace-owned customer identity, address, or initial booking parameters.
3. **Concurrency Safeguards:** Job offer acceptance and dispatch execution use database row locking (`select_for_update`) to prevent double-assignment or duplicate acceptances under concurrent HTTP requests.
