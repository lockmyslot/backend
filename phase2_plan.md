# Phase 2 — Auth & Groups

User registration (simple token auth) and group management (create, join, manage members).

---

## Auth Module

### Files

```
src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
└── dto/
    ├── register.dto.ts
    └── update-profile.dto.ts
```

### Endpoints

#### `POST /api/v1/auth/register`

No auth required. Creates a new user and returns their auth token.

**Request:**
```json
{
  "display_name": "Alice"
}
```

**Validation:**
- `display_name`: required, string, 2–50 characters, trimmed

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "display_name": "Alice",
    "auth_token": "uuid-v4-token",
    "created_at": "2026-08-09T17:00:00Z"
  }
}
```

**Logic:**
1. Generate UUID v4 for `id` and `auth_token`
2. Create user record
3. Return user with `auth_token` (this is the **only time** the token is returned — the client must store it)

---

#### `GET /api/v1/auth/me`

Requires auth. Returns current user profile.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "display_name": "Alice",
    "created_at": "2026-08-09T17:00:00Z",
    "updated_at": "2026-08-09T17:00:00Z"
  }
}
```

> [!NOTE]
> `auth_token` is deliberately **excluded** from the response — it should only be returned at registration.

---

#### `PATCH /api/v1/auth/me`

Requires auth. Updates the user's display name.

**Request:**
```json
{
  "display_name": "Alice B."
}
```

**Validation:** same as register

**Response (200):** updated user object (same shape as GET)

---

## Groups Module

### Files

```
src/groups/
├── groups.module.ts
├── groups.controller.ts
├── groups.service.ts
├── guards/
│   └── group-member.guard.ts
└── dto/
    ├── create-group.dto.ts
    ├── update-group.dto.ts
    └── join-group.dto.ts
```

### Group Member Guard

#### [NEW] [src/groups/guards/group-member.guard.ts](file:///home/krissh/Projects/openslot/src/groups/guards/group-member.guard.ts)

A guard that:
1. Extracts `:id` (or `:group_id`) from the route params
2. Checks that `request.user` is a member of that group
3. Attaches the membership (including `role`) to `request.groupMember`
4. If `@Roles(GroupRole.ADMIN)` is set, also checks the role
5. Returns 403 if not a member or insufficient role

This guard is applied to **all group-scoped endpoints** (groups, resources, bookings).

---

### Endpoints

#### `POST /api/v1/groups`

Requires auth. Creates a new group, creator becomes ADMIN.

**Request:**
```json
{
  "name": "Apartment 4B"
}
```

**Validation:**
- `name`: required, string, 2–100 characters, trimmed

**Logic:**
1. Generate a 6-character alphanumeric invite code (uppercase, e.g., `X7K9M2`)
2. Create group with `created_by = currentUser.id`
3. Create GroupMember with `role = ADMIN`
4. Return group with invite code

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Apartment 4B",
    "invite_code": "X7K9M2",
    "role": "ADMIN",
    "member_count": 1,
    "created_at": "2026-08-09T17:00:00Z"
  }
}
```

---

#### `GET /api/v1/groups`

Requires auth. Lists all groups the current user is a member of.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Apartment 4B",
      "role": "ADMIN",
      "member_count": 4,
      "created_at": "2026-08-09T17:00:00Z"
    }
  ]
}
```

> [!NOTE]
> `invite_code` is only returned when the user is an ADMIN of the group, or in the create/regenerate responses.

---

#### `GET /api/v1/groups/:id`

Requires membership. Returns group details.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Apartment 4B",
    "invite_code": "X7K9M2",
    "role": "ADMIN",
    "member_count": 4,
    "created_at": "2026-08-09T17:00:00Z"
  }
}
```

`invite_code` included only for ADMINs.

---

#### `POST /api/v1/groups/join`

Requires auth. Join a group using an invite code.

**Request:**
```json
{
  "invite_code": "X7K9M2"
}
```

**Validation:**
- `invite_code`: required, string, exactly 6 characters, uppercase alphanumeric

**Logic:**
1. Find group by invite code → 404 if not found
2. Check if user is already a member → 409 if yes
3. Create GroupMember with `role = MEMBER`
4. Return group details

**Response (201):** same shape as GET group

**Errors:**
- 404: `"invalid_invite_code"` — no group found for this code
- 409: `"already_a_member"` — user is already in this group

---

#### `PATCH /api/v1/groups/:id`

Requires ADMIN role. Updates group name.

**Request:**
```json
{
  "name": "Apartment 4B - Main"
}
```

**Response (200):** updated group object

---

#### `GET /api/v1/groups/:id/members`

Requires membership. Lists all members.

**Response (200):**
```json
{
  "data": [
    {
      "id": "user-uuid",
      "display_name": "Alice",
      "role": "ADMIN",
      "joined_at": "2026-08-09T17:00:00Z"
    },
    {
      "id": "user-uuid",
      "display_name": "Bob",
      "role": "MEMBER",
      "joined_at": "2026-08-10T10:00:00Z"
    }
  ]
}
```

---

#### `DELETE /api/v1/groups/:id/members/:user_id`

Requires ADMIN role. Removes a member from the group.

**Logic:**
1. Cannot remove yourself via this endpoint (use `/leave` instead)
2. Cannot remove another ADMIN (prevents admin wars — only self-demotion or leaving)
3. Delete the GroupMember record
4. Cancel all future CONFIRMED bookings for this user in this group

**Response (204):** no content

**Errors:**
- 400: `"cannot_remove_self"` — use the leave endpoint
- 403: `"cannot_remove_admin"` — can't remove another admin

---

#### `POST /api/v1/groups/:id/leave`

Requires membership. Leave a group voluntarily.

**Logic:**
1. If user is the **sole ADMIN** → 400 error (must transfer admin first, or the group has no admin)
2. Delete GroupMember record
3. Cancel all future CONFIRMED bookings for this user in this group

**Response (204):** no content

**Errors:**
- 400: `"sole_admin_cannot_leave"` — transfer admin role to another member first

---

#### `POST /api/v1/groups/:id/regenerate_invite`

Requires ADMIN role. Generates a new invite code (invalidates the old one).

**Logic:**
1. Generate new 6-char code
2. Update group record

**Response (200):**
```json
{
  "data": {
    "invite_code": "N3W1NV"
  }
}
```

---

## Verification

```bash
# Register two users
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Alice"}'

# Create a group (as Alice)
curl -X POST http://localhost:3000/api/v1/groups \
  -H "Authorization: Bearer <alice-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Apartment 4B"}'

# Join group (as Bob)
curl -X POST http://localhost:3000/api/v1/groups/join \
  -H "Authorization: Bearer <bob-token>" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "X7K9M2"}'

# List members
curl http://localhost:3000/api/v1/groups/<group-id>/members \
  -H "Authorization: Bearer <alice-token>"
```

Also verify via Swagger UI at `/api/docs`.

Phase 2 is complete when:
- [ ] Users can register and receive an auth token
- [ ] Users can view/update their profile
- [ ] Users can create groups (become ADMIN)
- [ ] Users can join groups via invite code
- [ ] Admin can manage members (remove, regenerate invite)
- [ ] Members can leave groups
- [ ] Sole admin cannot leave
- [ ] Group member guard correctly enforces membership and roles
- [ ] All responses use snake_case and the `{ data }` envelope
- [ ] Swagger docs show all endpoints with correct schemas
