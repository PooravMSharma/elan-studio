# Élan Studio — Milestone 1

Schema, seed data, and the availability engine. No UI yet.

## Files

| Path | What it is |
|---|---|
| `prisma/schema.prisma` | Full multi-tenant schema, 15 models |
| `prisma.config.ts` | Prisma 7 config — schema path, migrations path, seed command, database URL |
| `lib/prisma.ts` | Shared PrismaClient with the pg driver adapter |
| `prisma/seed.ts` | Élan Studio tenant: 10 services, 4 staff, schedules, discount codes, admin user |
| `lib/availability/core.ts` | Pure slot computation — no database, fully testable |
| `lib/availability/index.ts` | Prisma-backed wrapper that queries and delegates to the core |
| `scripts/verify-availability.ts` | 19 assertions covering the engine's behaviour |

## Setup

Built for **Prisma 7**. The connection URL lives in `prisma.config.ts`, not in the schema.

```bash
npm install @prisma/client @prisma/adapter-pg pg luxon bcryptjs dotenv
npm install -D prisma tsx typescript @types/luxon @types/node @types/bcryptjs @types/pg

cp .env.example .env    # point DATABASE_URL at Neon, Supabase, or local Postgres

npx prisma migrate dev --name init
npx prisma generate     # v7 no longer generates automatically on install
npx prisma db seed
```

Run the engine checks at any time — they need no database:

```bash
npx tsx scripts/verify-availability.ts
```

## Design decisions worth remembering

**Prisma 7 conventions.** The `prisma-client` generator outputs to `lib/generated/prisma`, so imports come from there rather than `@prisma/client`. Every client instance needs a driver adapter — `lib/prisma.ts` wires up `PrismaPg`.

**Every table carries `tenantId`.** One tenant is seeded, but the clinic/gym path stays open without a rewrite.

**Slots are computed, never stored.** A fixed slot grid cannot serve a 45-minute cut and a 3-hour bridal package at once. Candidate starts are generated on a 15-minute grid per service duration.

**Buffers belong to the existing appointment.** A booked appointment blocks `[start, end + bufferMin]`. A candidate slot must additionally keep its own buffer clear of any other booking, but may run its cleanup past closing time.

**Price is snapshotted on the appointment.** Raising a service price tomorrow must not silently rewrite last month's revenue.

**`@@unique([staffId, startsAt])`** makes double-booking impossible at the database level. Two people tapping the same 4pm slot is a real race that application checks lose.

**Times are stored in UTC, computed in the tenant's timezone.** The seed uses `Asia/Kolkata`.

**Staff schedules are intersected with salon opening hours.** A stylist rostered to 7pm on a day the salon shuts at 6pm gets slots until 6pm.

## Verified behaviour

- Open day produces slots from opening to the last start that finishes before close
- A booking removes its own slot, the slots that would overrun into it, and the buffer after it
- A salon-wide closure empties the day
- A 3-hour service yields far fewer slots than a 45-minute one, and is rejected from a 2-hour gap
- Split shifts (lunch breaks) leave a real hole in the day
- Same-day bookings respect a 60-minute minimum lead time
- 10:00 AM IST is stored as 04:30 UTC

## Next

Milestone 2 — the booking wizard: service → stylist → date/time → contact details → confirm, with the draft row written at the contact step so abandoned-booking recovery has something to work with.