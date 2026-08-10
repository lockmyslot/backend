# Phase 3 — Resources & Booking Rules

Resource CRUD and configurable booking rules per resource.

---

## Resources Module

### Files

```
src/resources/
├── resources.module.ts
├── resources.controller.ts
├── resources.service.ts
└── dto/
    ├── create-resource.dto.ts
    └── update-resource.dto.ts
```

### Endpoints

#### `POST /api/v1/groups/:group_id/resources`

Requires ADMIN role.

**Request:**
```json
{
  "name": "Washing Machine",
  "description": "Ground floor laundry room",
  "capacity": 1,
  "slot_duration_minutes": 60
}
```

**Validation:**
- `name`: required, string, 2–100 chars
- `description`: optional, string, max 500 chars
- `capacity`: required, integer, min 1, max 100
- `slot_duration_minutes`: required, integer, min 15, max 1080 (18h), must be a multiple of 15

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "group_id": "uuid",
    "name": "Washing Machine",
    "description": "Ground floor laundry room",
    "capacity": 1,
    "slot_duration_minutes": 60,
    "is_active": true,
    "created_at": "2026-08-09T17:00:00Z",
    "updated_at": "2026-08-09T17:00:00Z"
  }
}
```

---

#### `GET /api/v1/groups/:group_id/resources`

Requires membership. Lists all **active** resources in the group.

**Query params:**
- `include_inactive`: `true` to include soft-deleted resources (ADMIN only)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Washing Machine",
      "description": "Ground floor laundry room",
      "capacity": 1,
      "slot_duration_minutes": 60,
      "is_active": true,
      "rules_configured": true,
      "created_at": "2026-08-09T17:00:00Z"
    }
  ]
}
```

`rules_configured` is a computed boolean — `true` if at least one BookingRule exists for this resource. Helps the admin see which resources still need rules set up.

---

#### `GET /api/v1/groups/:group_id/resources/:id`

Requires membership. Returns resource details with its booking rules included.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Washing Machine",
    "description": "Ground floor laundry room",
    "capacity": 1,
    "slot_duration_minutes": 60,
    "is_active": true,
    "booking_rules": [
      {
        "day_scope": "WEEKDAY",
        "max_bookings_per_day": 2,
        "max_hours_per_day": 3,
        "cooldown_minutes": 60,
        "min_duration_minutes": 30,
        "max_duration_minutes": 120,
        "max_advance_booking_days": 7,
        "available_from": "08:00",
        "available_until": "22:00"
      }
    ],
    "created_at": "2026-08-09T17:00:00Z",
    "updated_at": "2026-08-09T17:00:00Z"
  }
}
```

---

#### `PATCH /api/v1/groups/:group_id/resources/:id`

Requires ADMIN role. Partial update.

**Request:**
```json
{
  "name": "Washing Machine #1",
  "capacity": 2
}
```

All fields optional. Same validation as create for each provided field.

**Response (200):** updated resource object

> [!NOTE]
> Changing `slot_duration_minutes` on a resource that already has bookings is allowed, but only affects **future** bookings. Existing bookings are not re-validated.

---

#### `DELETE /api/v1/groups/:group_id/resources/:id`

Requires ADMIN role. Soft-deletes the resource (`is_active = false`).

**Logic:**
1. Set `is_active = false`
2. Cancel all **future** CONFIRMED bookings on this resource
3. Keep the resource and its historical bookings for reference

**Response (204):** no content

---

## Booking Rules Module

### Files

```
src/booking-rules/
├── booking-rules.module.ts
├── booking-rules.controller.ts
├── booking-rules.service.ts
└── dto/
    └── upsert-rules.dto.ts
```

### Endpoints

#### `GET /api/v1/groups/:group_id/resources/:resource_id/rules`

Requires membership. Returns all rules for a resource.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "day_scope": "WEEKDAY",
      "max_bookings_per_day": 2,
      "max_hours_per_day": 3,
      "cooldown_minutes": 60,
      "min_duration_minutes": 30,
      "max_duration_minutes": 120,
      "max_advance_booking_days": 7,
      "available_from": "08:00",
      "available_until": "22:00"
    },
    {
      "id": "uuid",
      "day_scope": "WEEKEND",
      "max_bookings_per_day": 3,
      "max_advance_booking_days": 3,
      "available_from": "10:00",
      "available_until": "20:00"
    }
  ]
}
```

---

#### `PUT /api/v1/groups/:group_id/resources/:resource_id/rules`

Requires ADMIN role. **Replaces all rules** for this resource atomically.

This is a bulk upsert: the client sends the complete desired rule set, and the backend deletes all existing rules and creates the new ones in a transaction.

**Request:**
```json
[
  {
    "day_scope": "WEEKDAY",
    "max_bookings_per_day": 2,
    "max_hours_per_day": 3,
    "cooldown_minutes": 60,
    "min_duration_minutes": 30,
    "max_duration_minutes": 120,
    "max_advance_booking_days": 7,
    "available_from": "08:00",
    "available_until": "22:00"
  },
  {
    "day_scope": "FRIDAY",
    "max_bookings_per_day": 1,
    "max_duration_minutes": 60,
    "available_from": "18:00",
    "available_until": "23:00"
  }
]
```

**Validation per rule:**
- `day_scope`: required, must be one of `WEEKDAY | WEEKEND | MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY`
- `max_bookings_per_day`: optional, integer, min 1
- `max_hours_per_day`: optional, integer, min 1
- `cooldown_minutes`: optional, integer, min 0
- `min_duration_minutes`: optional, integer, min 1
- `max_duration_minutes`: optional, integer, min 1
- `max_advance_booking_days`: optional, integer, min 1
- `available_from`: optional, string, `HH:mm` format (24h)
- `available_until`: optional, string, `HH:mm` format (24h), must be after `available_from`

**Array-level validation:**
- No duplicate `day_scope` values in the same request
- If `min_duration_minutes` and `max_duration_minutes` both set, min must be ≤ max
- `min_duration_minutes` must be ≥ `slot_duration_minutes` of the resource
- Empty array `[]` is valid — clears all rules (allows unrestricted booking)

**Logic:**
1. Validate all rules
2. Begin transaction
3. Delete all existing BookingRule records for this resource
4. Insert new rules
5. Commit

**Response (200):** the created rules array (same shape as GET)

> [!IMPORTANT]
> Updating rules does **not** retroactively invalidate existing bookings. Only new bookings are validated against the updated rules.

---

### Rule Priority (reminder)

When evaluating a booking for a specific day, the system resolves rules in this order:

```
1. Day-specific rule (MONDAY, TUESDAY, ..., SUNDAY)   → highest priority
2. Day-group rule   (WEEKDAY or WEEKEND)               → fallback
3. No rule found                                       → allow (only capacity check)
```

Example: If both a `WEEKDAY` rule and a `FRIDAY` rule exist, a Friday booking uses the `FRIDAY` rule exclusively — rules are **not merged**.

---

## Verification

```bash
# Create a resource (as admin)
curl -X POST http://localhost:3000/api/v1/groups/<group-id>/resources \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Washing Machine", "capacity": 1, "slot_duration_minutes": 60}'

# Set booking rules
curl -X PUT http://localhost:3000/api/v1/groups/<group-id>/resources/<resource-id>/rules \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '[{"day_scope": "WEEKDAY", "max_bookings_per_day": 2, "available_from": "08:00", "available_until": "22:00"}]'

# Get resource with rules
curl http://localhost:3000/api/v1/groups/<group-id>/resources/<resource-id> \
  -H "Authorization: Bearer <member-token>"
```

Phase 3 is complete when:
- [ ] Admin can create, update, and soft-delete resources
- [ ] Members can list and view resources
- [ ] Admin can bulk-upsert booking rules per resource
- [ ] Duplicate `day_scope` validation works
- [ ] Duration constraints are validated against `slot_duration_minutes`
- [ ] Clearing rules with `[]` works
- [ ] Soft-delete cancels future bookings
- [ ] `rules_configured` flag computes correctly
- [ ] All responses use snake_case and `{ data }` envelope
- [ ] Swagger docs show all endpoints
