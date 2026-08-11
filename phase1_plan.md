# Phase 1 — Project Setup & Infrastructure

Scaffolding, Prisma schema, Docker, Swagger, and shared infrastructure (guards, interceptors, filters).

---

## Step 1: Scaffold NestJS Project

```bash
npx -y @nestjs/cli new lockmyslot --package-manager pnpm --skip-git
```

Install dependencies:

```bash
# Prisma
pnpm add @prisma/client
pnpm add -D prisma

# Validation & transformation
pnpm add class-validator class-transformer

# Swagger (OAS 3)
pnpm add @nestjs/swagger

# UUID generation
pnpm add uuid
pnpm add -D @types/uuid

# Config
pnpm add @nestjs/config
```

---

## Step 2: Docker Compose (PostgreSQL)

#### [NEW] [docker-compose.yml](file:///home/krissh/Projects/lockmyslot/docker-compose.yml)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: lockmyslot
      POSTGRES_PASSWORD: lockmyslot
      POSTGRES_DB: lockmyslot
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

#### [NEW] [.env](file:///home/krissh/Projects/lockmyslot/.env)

```env
DATABASE_URL="postgresql://lockmyslot:lockmyslot@localhost:5432/lockmyslot?schema=public"
PORT=3000
```

---

## Step 3: Prisma Schema

#### [NEW] [prisma/schema.prisma](file:///home/krissh/Projects/lockmyslot/prisma/schema.prisma)

Full schema with all 6 tables, enums, relations, and indexes:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───

enum GroupRole {
  ADMIN
  MEMBER
}

enum DayScope {
  WEEKDAY
  WEEKEND
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}

// ─── Models ───

model User {
  id          String   @id @default(uuid()) @db.Uuid
  displayName String   @map("display_name")
  authToken   String   @unique @map("auth_token") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  memberships  GroupMember[]
  bookings     Booking[]
  createdGroups Group[]       @relation("GroupCreator")

  @@map("users")
}

model Group {
  id         String   @id @default(uuid()) @db.Uuid
  name       String
  inviteCode String   @unique @map("invite_code")
  createdById String  @map("created_by") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  createdBy  User          @relation("GroupCreator", fields: [createdById], references: [id])
  members    GroupMember[]
  resources  Resource[]
  bookings   Booking[]

  @@map("groups")
}

model GroupMember {
  id       String    @id @default(uuid()) @db.Uuid
  groupId  String    @map("group_id") @db.Uuid
  userId   String    @map("user_id") @db.Uuid
  role     GroupRole @default(MEMBER)
  joinedAt DateTime  @default(now()) @map("joined_at")

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
  @@map("group_members")
}

model Resource {
  id                  String   @id @default(uuid()) @db.Uuid
  groupId             String   @map("group_id") @db.Uuid
  name                String
  description         String?
  capacity            Int      @default(1)
  slotDurationMinutes Int      @map("slot_duration_minutes") @default(30)
  isActive            Boolean  @default(true) @map("is_active")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  group        Group         @relation(fields: [groupId], references: [id], onDelete: Cascade)
  bookingRules BookingRule[]
  bookings     Booking[]

  @@map("resources")
}

model BookingRule {
  id                   String   @id @default(uuid()) @db.Uuid
  resourceId           String   @map("resource_id") @db.Uuid
  dayScope             DayScope @map("day_scope")
  maxBookingsPerDay    Int?     @map("max_bookings_per_day")
  maxHoursPerDay       Int?     @map("max_hours_per_day")
  cooldownMinutes      Int?     @map("cooldown_minutes")
  minDurationMinutes   Int?     @map("min_duration_minutes")
  maxDurationMinutes   Int?     @map("max_duration_minutes")
  maxAdvanceBookingDays Int?    @map("max_advance_booking_days")
  availableFrom        String?  @map("available_from")   // "HH:mm" format
  availableUntil       String?  @map("available_until")   // "HH:mm" format

  resource Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  @@unique([resourceId, dayScope])
  @@map("booking_rules")
}

model Booking {
  id         String        @id @default(uuid()) @db.Uuid
  resourceId String        @map("resource_id") @db.Uuid
  userId     String        @map("user_id") @db.Uuid
  groupId    String        @map("group_id") @db.Uuid
  startTime  DateTime      @map("start_time")
  endTime    DateTime      @map("end_time")
  status     BookingStatus @default(CONFIRMED)
  createdAt  DateTime      @default(now()) @map("created_at")
  updatedAt  DateTime      @updatedAt @map("updated_at")

  resource Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  group    Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([resourceId, startTime, endTime])
  @@index([userId, groupId])
  @@map("bookings")
}
```

Key design notes:
- **`@@map`** on every model/field ensures PostgreSQL uses snake_case table and column names
- **`@@unique([resourceId, dayScope])`** on BookingRule prevents duplicate rules per day scope
- **`@@unique([groupId, userId])`** on GroupMember prevents duplicate memberships
- **Composite index** on Booking `[resourceId, startTime, endTime]` for fast overlap queries
- **`availableFrom`/`availableUntil`** stored as `String` ("HH:mm") since Prisma doesn't have a native time-only type

After schema creation:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Step 4: Prisma Service Module

#### [NEW] [src/prisma/prisma.service.ts](file:///home/krissh/Projects/lockmyslot/src/prisma/prisma.service.ts)

Standard NestJS Prisma service with `onModuleInit` for connection and `enableShutdownHooks`.

#### [NEW] [src/prisma/prisma.module.ts](file:///home/krissh/Projects/lockmyslot/src/prisma/prisma.module.ts)

Global module exporting `PrismaService` so all other modules can inject it without importing.

---

## Step 5: Common Infrastructure

### Auth Guard

#### [NEW] [src/common/guards/auth.guard.ts](file:///home/krissh/Projects/lockmyslot/src/common/guards/auth.guard.ts)

- Reads `Authorization: Bearer <token>` header
- Looks up user by `auth_token` in the database
- Attaches user to `request.user`
- Returns 401 if token missing or invalid

### Current User Decorator

#### [NEW] [src/common/decorators/current-user.decorator.ts](file:///home/krissh/Projects/lockmyslot/src/common/decorators/current-user.decorator.ts)

`@CurrentUser()` parameter decorator that extracts `request.user` — avoids reaching into the raw request object in controllers.

### Snake Case Serialization Interceptor

#### [NEW] [src/common/interceptors/serialize.interceptor.ts](file:///home/krissh/Projects/lockmyslot/src/common/interceptors/serialize.interceptor.ts)

Global interceptor that:
1. Recursively converts all response object keys from camelCase → snake_case
2. Wraps the response in the `{ data, meta }` envelope
3. Handles pagination metadata when present

This lets us write idiomatic camelCase TypeScript internally while serving snake_case JSON externally.

### Global Exception Filter

#### [NEW] [src/common/filters/http-exception.filter.ts](file:///home/krissh/Projects/lockmyslot/src/common/filters/http-exception.filter.ts)

Catches all exceptions and returns consistent error responses:

```json
{
  "error": {
    "status_code": 400,
    "message": "Validation failed",
    "details": ["display_name must be a string"]
  }
}
```

### Roles Decorator

#### [NEW] [src/common/decorators/roles.decorator.ts](file:///home/krissh/Projects/lockmyslot/src/common/decorators/roles.decorator.ts)

`@Roles(GroupRole.ADMIN)` decorator for marking endpoints that require a specific group role. Used in conjunction with the group member guard (Phase 2).

---

## Step 6: Swagger / OAS 3 Setup

#### [MODIFY] [src/main.ts](file:///home/krissh/Projects/lockmyslot/src/main.ts)

Configure Swagger with OAS 3 output:

```typescript
const config = new DocumentBuilder()
  .setTitle('Lock My Slot API')
  .setDescription('Resource booking API for small groups')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Also in `main.ts`:
- Register global validation pipe (`class-validator`)
- Register the snake_case serialization interceptor
- Register the global exception filter
- Set global prefix `/api/v1`
- Enable CORS

---

## Step 7: Seed Script

#### [NEW] [prisma/seed.ts](file:///home/krissh/Projects/lockmyslot/prisma/seed.ts)

Creates sample data for dev:
- 2 users (Alice as admin, Bob as member)
- 1 group ("Roommates") with both users
- 2 resources ("Washing Machine" with capacity 1, "Kitchen" with capacity 2)
- Weekday + weekend booking rules for each resource
- A few sample bookings

Configure in `package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Install tsx as a dev dependency:
```bash
pnpm add -D tsx
```

---

## Verification

```bash
# Start PostgreSQL
docker compose up -d

# Run migration
pnpm prisma migrate dev --name init

# Seed the database
pnpm prisma db seed

# Start the server
pnpm run start:dev

# Verify Swagger UI
# Open http://localhost:3000/api/docs — should show OAS 3 spec with bearer auth
```

Phase 1 is complete when:
- [x] `docker compose up` starts PostgreSQL
- [x] Prisma migration creates all 6 tables with correct snake_case columns
- [x] Seed data populates the database
- [x] `npm run start:dev` starts without errors
- [x] Swagger UI loads at `/api/docs` with OAS 3 spec
- [x] Auth guard returns 401 for requests without a valid token
