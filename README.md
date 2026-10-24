# Lock My Slot — Backend API

NestJS 11 backend service for the Lock My Slot resource booking platform.

## Features

- **Authentication**: Bearer token authentication and username/password login with bcrypt password hashing.
- **Group Management**: Multi-tenant groups with unique 6-character invite codes and role-based access control (`ADMIN`, `MEMBER`).
- **Resource Management**: Capacity, customizable slot duration, and soft deactivation.
- **Booking Rules Engine**: Configurable day scopes (weekday, weekend, specific days), cooldown requirements, daily limits, operating hours, and advance booking windows.
- **Bookings & Slot Availability**: Dynamic slot generation and capacity enforcement.
- **Maintenance Scheduler**: One-time and recurring (daily/weekly) maintenance tasks, task assignee support, status workflow, and booking override logic.
- **OpenAPI 3.0**: Auto-generated Swagger documentation at `/api/docs`.

---

## Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v9 or higher
- **PostgreSQL**: v14 or higher

---

## Installation & Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
# Set DATABASE_URL and PORT in your .env file
# Example: DATABASE_URL="postgresql://user:password@localhost:5432/lockmyslot?schema=public"

# 3. Apply Prisma migrations
pnpm prisma migrate dev

# 4. (Optional) Seed the database
pnpm prisma db seed
```

---

## Running the Application

```bash
# Development mode with watch
pnpm run start:dev

# Production build
pnpm run build
pnpm run start:prod
```

Once running:
- **API Base URL**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/api/docs`

---

## Testing

```bash
# Unit tests
pnpm run test

# End-to-end tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

---

## Full Functional Specification

For complete API documentation, domain models, and rule engine behavior, refer to:
[Functional Specification](docs/FUNCTIONAL_SPECIFICATION.md)
