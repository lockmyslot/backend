# Phase 4 — Bookings & Rule Engine

The core module: creating bookings with rule validation, checking availability, and the rule evaluation engine.

---

## Bookings Module

### Files

```
src/bookings/
├── bookings.module.ts
├── bookings.controller.ts
├── bookings.service.ts
├── rules.service.ts          # Rule evaluation engine
└── dto/
    ├── create-booking.dto.ts
    ├── list-bookings.dto.ts   # Query params DTO
    └── availability.dto.ts    # Query params DTO
```

---

## Endpoints

### `POST /api/v1/groups/:group_id/resources/:resource_id/bookings`

Requires membership. Creates a new booking after validating rules and capacity.

**Request:**
```json
{
  "start_time": "2026-08-11T09:00:00Z",
  "end_time": "2026-08-11T10:00:00Z"
}
```

**Validation (DTO-level):**
- `start_time`: required, ISO 8601 datetime, must be in the future
- `end_time`: required, ISO 8601 datetime, must be after `start_time`

**Logic:**
1. Parse and validate the DTO
2. Check resource exists and `is_active = true`
3. Verify duration is a multiple of `slot_duration_minutes`
4. Call `RulesService.validate()` → returns `{ allowed, violations }`
5. If not allowed → 400 with violations list
6. Check capacity (see overlap query below)
7. If capacity full → 409 with `"slot_full"` error
8. Create booking with `status = CONFIRMED`

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "resource_id": "uuid",
    "resource_name": "Washing Machine",
    "user_id": "uuid",
    "group_id": "uuid",
    "start_time": "2026-08-11T09:00:00Z",
    "end_time": "2026-08-11T10:00:00Z",
    "status": "CONFIRMED",
    "created_at": "2026-08-09T17:00:00Z"
  }
}
```

**Error responses:**

400 — Rule violation:
```json
{
  "error": {
    "status_code": 400,
    "message": "booking_rule_violation",
    "details": [
      "exceeds max_bookings_per_day (limit: 2, current: 2)",
      "outside available hours (allowed: 08:00–22:00)"
    ]
  }
}
```

409 — Slot full:
```json
{
  "error": {
    "status_code": 409,
    "message": "slot_full",
    "details": ["resource capacity reached for this time slot (capacity: 1, booked: 1)"]
  }
}
```

### Overlap Detection Query

To check capacity, we count CONFIRMED bookings that overlap with the requested time window:

```sql
SELECT COUNT(*) FROM bookings
WHERE resource_id = :resourceId
  AND status = 'CONFIRMED'
  AND start_time < :endTime
  AND end_time > :startTime
```

If `COUNT >= resource.capacity` → slot is full.

> [!IMPORTANT]
> **Race condition**: Two concurrent requests could both pass the capacity check. We handle this with a database-level unique constraint approach — wrap the capacity check + insert in a **serializable transaction** or use `SELECT ... FOR UPDATE` on the resource row to serialize concurrent bookings for the same resource.

---

### `GET /api/v1/groups/:group_id/resources/:resource_id/bookings`

Requires membership. Lists bookings for a resource within a date range.

**Query params:**
- `date`: single date, `YYYY-MM-DD` — returns all bookings for that day
- `from`: start of range, `YYYY-MM-DD` (defaults to today)
- `to`: end of range, `YYYY-MM-DD` (defaults to `from + 7 days`)

If `date` is provided, `from` and `to` are ignored.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "resource_id": "uuid",
      "user_id": "uuid",
      "user_display_name": "Alice",
      "start_time": "2026-08-11T09:00:00Z",
      "end_time": "2026-08-11T10:00:00Z",
      "status": "CONFIRMED",
      "created_at": "2026-08-09T17:00:00Z"
    }
  ]
}
```

---

### `GET /api/v1/groups/:group_id/resources/:resource_id/availability`

Requires membership. Returns available time slots for a specific date, considering capacity and rules.

**Query params:**
- `date`: required, `YYYY-MM-DD`

**Logic:**
1. Get the resource's `slot_duration_minutes`
2. Find the applicable booking rule for this day (day-specific > weekday/weekend)
3. Determine the available window: `[available_from, available_until]` or `[00:00, 23:59]` if no rule
4. Generate all possible slots within the window based on `slot_duration_minutes`
5. For each slot, count existing CONFIRMED bookings that overlap
6. Mark each slot as `available` (booked count < capacity) or `full`
7. Also include the current user's booking count and hours for the day (for client-side rule feedback)

**Response (200):**
```json
{
  "data": {
    "date": "2026-08-11",
    "resource_id": "uuid",
    "slot_duration_minutes": 60,
    "available_from": "08:00",
    "available_until": "22:00",
    "user_stats": {
      "bookings_today": 1,
      "hours_today": 1.0,
      "max_bookings_per_day": 2,
      "max_hours_per_day": 3,
      "cooldown_minutes": 60,
      "last_booking_end": "2026-08-11T10:00:00Z"
    },
    "slots": [
      { "start_time": "2026-08-11T08:00:00Z", "end_time": "2026-08-11T09:00:00Z", "status": "available", "booked": 0, "capacity": 1 },
      { "start_time": "2026-08-11T09:00:00Z", "end_time": "2026-08-11T10:00:00Z", "status": "full",      "booked": 1, "capacity": 1 },
      { "start_time": "2026-08-11T10:00:00Z", "end_time": "2026-08-11T11:00:00Z", "status": "cooldown",   "booked": 0, "capacity": 1 },
      { "start_time": "2026-08-11T11:00:00Z", "end_time": "2026-08-11T12:00:00Z", "status": "available", "booked": 0, "capacity": 1 }
    ]
  }
}
```

Slot statuses:
- `available` — can be booked
- `full` — capacity reached
- `cooldown` — within cooldown window of user's previous booking (user-specific)
- `unavailable` — outside available hours or user has exceeded daily limits

The `user_stats` section gives the Flutter app enough info to show warnings like "You have 1 booking left today" without extra API calls.

---

### `DELETE /api/v1/groups/:group_id/bookings/:id`

Requires booking owner or ADMIN. Cancels a booking.

**Logic:**
1. Find booking by ID, scoped to the group
2. Check ownership or admin role
3. Booking must be in `CONFIRMED` status and `start_time` must be in the future
4. Set `status = CANCELLED`

**Response (204):** no content

**Errors:**
- 404: booking not found in this group
- 400: `"booking_already_cancelled"` or `"cannot_cancel_past_booking"`
- 403: not the owner and not an admin

---

### `GET /api/v1/groups/:group_id/my_bookings`

Requires membership. Lists the current user's bookings across all resources in the group.

**Query params:**
- `from`: start date, `YYYY-MM-DD` (defaults to today)
- `to`: end date, `YYYY-MM-DD` (defaults to `from + 30 days`)
- `status`: `CONFIRMED` | `CANCELLED` (defaults to `CONFIRMED`)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "resource_id": "uuid",
      "resource_name": "Washing Machine",
      "start_time": "2026-08-11T09:00:00Z",
      "end_time": "2026-08-11T10:00:00Z",
      "status": "CONFIRMED",
      "created_at": "2026-08-09T17:00:00Z"
    }
  ]
}
```

---

## Rule Evaluation Engine

#### [NEW] [src/bookings/rules.service.ts](file:///home/krissh/Projects/lockmyslot/src/bookings/rules.service.ts)

The core business logic — a standalone service with no side effects (pure validation).

### Algorithm

```
validate(resource, userId, groupId, startTime, endTime):

  violations = []

  // ── 1. BASIC CHECKS ──
  duration = (endTime - startTime) in minutes
  
  if duration <= 0:
    violations.push("end_time must be after start_time")
    return EARLY

  if startTime <= now:
    violations.push("start_time must be in the future")

  if duration % resource.slotDurationMinutes != 0:
    violations.push("duration must be a multiple of slot_duration_minutes ({resource.slotDurationMinutes})")

  if !resource.isActive:
    violations.push("resource is inactive")
    return EARLY

  // ── 2. RULE RESOLUTION ──
  dayOfWeek = getDayName(startTime)           // "MONDAY", "TUESDAY", etc.
  dayGroup  = isWeekend(startTime) ? "WEEKEND" : "WEEKDAY"

  rule = db.findFirst(resourceId, dayScope = dayOfWeek)
       ?? db.findFirst(resourceId, dayScope = dayGroup)
       ?? null

  // If no rule exists, skip to capacity check
  if rule == null:
    goto CAPACITY_CHECK

  // ── 3. AVAILABILITY WINDOW ──
  if rule.availableFrom AND rule.availableUntil:
    bookingStart = timeOnly(startTime)   // "09:00"
    bookingEnd   = timeOnly(endTime)     // "10:00"
    
    if bookingStart < rule.availableFrom:
      violations.push("starts before available_from ({rule.availableFrom})")
    if bookingEnd > rule.availableUntil:
      violations.push("ends after available_until ({rule.availableUntil})")

  // ── 4. DURATION LIMITS ──
  if rule.minDurationMinutes AND duration < rule.minDurationMinutes:
    violations.push("duration {duration}min < min_duration {rule.minDurationMinutes}min")

  if rule.maxDurationMinutes AND duration > rule.maxDurationMinutes:
    violations.push("duration {duration}min > max_duration {rule.maxDurationMinutes}min")

  // ── 5. ADVANCE BOOKING ──
  if rule.maxAdvanceBookingDays:
    daysAhead = daysBetween(now, startTime)
    if daysAhead > rule.maxAdvanceBookingDays:
      violations.push("booking is {daysAhead} days ahead, max allowed is {rule.maxAdvanceBookingDays}")

  // ── 6. DAILY BOOKING COUNT ──
  if rule.maxBookingsPerDay:
    todayBookings = db.count(
      resourceId, userId, status=CONFIRMED,
      startTime between startOfDay(startTime) and endOfDay(startTime)
    )
    if todayBookings >= rule.maxBookingsPerDay:
      violations.push("max_bookings_per_day reached ({rule.maxBookingsPerDay})")

  // ── 7. DAILY HOURS ──
  if rule.maxHoursPerDay:
    todayHours = db.sumDuration(
      resourceId, userId, status=CONFIRMED,
      startTime between startOfDay(startTime) and endOfDay(startTime)
    ) in hours
    if todayHours + (duration / 60) > rule.maxHoursPerDay:
      violations.push("max_hours_per_day would be exceeded ({todayHours + duration/60} > {rule.maxHoursPerDay})")

  // ── 8. COOLDOWN ──
  if rule.cooldownMinutes:
    // Find the nearest booking (before or after) by this user on this resource
    nearestBefore = db.findFirst(
      resourceId, userId, status=CONFIRMED,
      endTime <= startTime, orderBy endTime DESC
    )
    nearestAfter = db.findFirst(
      resourceId, userId, status=CONFIRMED,
      startTime >= endTime, orderBy startTime ASC
    )
    
    if nearestBefore AND (startTime - nearestBefore.endTime) < cooldownMinutes:
      violations.push("cooldown: {cooldownMinutes}min required after previous booking ending at {nearestBefore.endTime}")
    
    if nearestAfter AND (nearestAfter.startTime - endTime) < cooldownMinutes:
      violations.push("cooldown: {cooldownMinutes}min required before next booking starting at {nearestAfter.startTime}")

  // ── 9. CAPACITY CHECK ──
  CAPACITY_CHECK:
  overlapping = db.count(
    resourceId, status=CONFIRMED,
    start_time < endTime AND end_time > startTime
  )
  if overlapping >= resource.capacity:
    return { allowed: false, violations: ["slot_full"], is_capacity_error: true }

  // ── RESULT ──
  return {
    allowed: violations.length == 0,
    violations: violations,
    is_capacity_error: false
  }
```

### Key design decisions:

1. **Rule resolution is exclusive** — if a FRIDAY rule exists, the WEEKDAY rule is completely ignored for Friday bookings. Rules are NOT merged.

2. **All violations are collected** — we don't short-circuit after the first failure (except for the early returns). This gives the user a complete picture of what's wrong.

3. **Capacity check is separate** — it returns `is_capacity_error: true` so the controller can return 409 instead of 400 for capacity issues.

4. **Cooldown is bidirectional** — checks both before and after the requested slot. If a user has a booking at 10:00–11:00 and cooldown is 60min, they can't book 9:00–10:00 OR 11:00–12:00.

5. **Daily counts are per-resource, per-user** — not across all resources in the group. Each resource has its own limits.

---

## Timezone Handling

> [!IMPORTANT]
> All times are stored and processed in **UTC**. The Flutter app is responsible for converting to/from the user's local timezone. The API docs will clearly state that all datetime fields are UTC ISO 8601.
>
> For `available_from` / `available_until` (stored as `"HH:mm"` strings), the admin sets these in their local context. For the MVP, we treat these as **UTC times**. If timezone-aware availability windows are needed later, we can add a `timezone` field to the Group model.

---

## Verification

### Unit Tests for RulesService

```bash
npm run test -- --testPathPattern=rules.service
```

Test cases:
1. ✅ Booking within all rules → allowed
2. ❌ Booking outside availability window → violation
3. ❌ Duration below minimum → violation
4. ❌ Duration above maximum → violation
5. ❌ Duration not a multiple of slot_duration → violation
6. ❌ Exceeds max_bookings_per_day → violation
7. ❌ Exceeds max_hours_per_day → violation
8. ❌ Violates cooldown (before) → violation
9. ❌ Violates cooldown (after) → violation
10. ❌ Exceeds max_advance_booking_days → violation
11. ❌ Capacity full → slot_full (409)
12. ✅ No rules configured → only capacity check
13. ✅ Day-specific rule overrides weekday/weekend rule
14. ❌ Multiple violations at once → all returned
15. ❌ Booking in the past → violation
16. ❌ Resource inactive → violation

### Integration Tests

```bash
npm run test:e2e
```

End-to-end flows:
1. Register → Create group → Create resource → Set rules → Book → Verify
2. Book → Try duplicate book → Verify 409
3. Book two slots → Try third → Verify max_bookings_per_day
4. Book → Cancel → Book same slot → Verify success

### Manual via Swagger

```bash
# Create a booking
curl -X POST http://localhost:3000/api/v1/groups/<gid>/resources/<rid>/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"start_time": "2026-08-11T09:00:00Z", "end_time": "2026-08-11T10:00:00Z"}'

# Check availability
curl "http://localhost:3000/api/v1/groups/<gid>/resources/<rid>/availability?date=2026-08-11" \
  -H "Authorization: Bearer <token>"

# My bookings
curl "http://localhost:3000/api/v1/groups/<gid>/my_bookings?from=2026-08-01&to=2026-08-31" \
  -H "Authorization: Bearer <token>"
```

Phase 4 is complete when:
- [ ] Bookings can be created with full rule validation
- [ ] All 8 rule checks work correctly
- [ ] Day-specific rules take priority over weekday/weekend rules
- [ ] Capacity is enforced with concurrent booking protection
- [ ] Availability endpoint returns correct slot statuses
- [ ] User stats (daily count, hours, cooldown) are accurate
- [ ] Bookings can be cancelled by owner or admin
- [ ] Past bookings cannot be cancelled
- [ ] My bookings endpoint works with filters
- [ ] Unit tests pass for rules service
- [ ] All responses use snake_case and `{ data }` envelope
