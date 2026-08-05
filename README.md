# Élan Studio

**Salons run their bookings on a phone that nobody can answer mid-haircut.**

Appointments arrive by call and WhatsApp, get written into a paper diary, and no-shows cost real money because nobody has time to send reminders. Élan Studio replaces that with online booking, automatic WhatsApp confirmations and reminders, and one dashboard where the owner sees the day, the money, and every customer.

Built as a complete online business system for a fictional premium salon in Jaipur — a customer-facing storefront and booking wizard, an owner's admin dashboard, and a WhatsApp automation layer. Every table carries a `tenantId`, so the same system runs a clinic, a spa, or a tattoo studio without a rewrite.

Next.js 16 (App Router) · React 19 · Prisma 7 · PostgreSQL · Auth.js v5 · Luxon

---

## Live demo

(https://elan-studios-poorav-sharma.vercel.app/)

Admin sign-in at `/admin/login`

```
owner@elanstudio.example
elan-demo-2026
```

---

## Screenshots

![Storefront](docs/screenshots/storefront.png)

*The storefront — hero, service menu and team, all rendered from tenant data. Nothing about Élan is hardcoded in the markup.*

![Picking a time](docs/screenshots/booking-time.png)

*Slots are computed per service duration against the stylist's shifts, existing bookings and cleanup buffers — never a fixed grid. The running ticket fills in as you go.*

![Contact details](docs/screenshots/booking-details.png)

*Contact details come before confirmation, not after. The draft row written at this step is what abandoned-booking recovery works from.*

![Confirmation](docs/screenshots/confirmation.png)

*Confirmation, with the WhatsApp message already queued.*

![Today](docs/screenshots/admin-today.png)

*The owner's day: what's booked, what's awaiting a response, month-to-date revenue, and how many messages are queued.*

---

## What it does

**For the customer**

- Browse services, prices and stylists on a storefront built entirely from tenant data
- Book in four steps — no account, no password, just a name and a mobile number
- Choose a specific stylist or "first available", which searches across everyone who offers that service
- Get a WhatsApp confirmation immediately, and a reminder the day before

**For the owner**

- See today's diary, the count awaiting a response, and month-to-date revenue on one screen
- Accept, cancel, reschedule or mark no-show — rescheduling re-checks availability, so hand-edits can't double-book
- Manage the service menu, the team, weekly shifts (including split shifts for lunch breaks) and closures
- Look up any customer with their full booking history and spend
- Watch the message queue: what's sent, what's due, what failed and why

**Automatically**

- Booking confirmation and an owner alert, immediately
- A reminder 24 hours before the appointment
- A review request two hours after it ends
- A follow-up to anyone who started booking, left a number, and didn't finish

Cancelling an appointment cancels its pending messages. Rescheduling moves them. A customer who opts out gets none of them.

---

## Setup

Built for **Prisma 7**. The database URL lives in `prisma.config.ts` (read from the environment), not in the schema. The `prisma-client` generator outputs to `lib/generated/prisma`, so client imports come from there — and every client instance needs a driver adapter, which `lib/prisma.ts` wires up with `PrismaPg`.

```bash
npm install

cp .env.example .env    # point DATABASE_URL at Neon, Supabase, or local Postgres

npx prisma migrate dev  # applies migrations
npx prisma generate     # v7 no longer generates automatically on install
npx prisma db seed      # Élan Studio: 10 services, 4 staff, schedules, discount codes, admin user

npm run dev -- -p 3002  # http://localhost:3002
```

> Élan runs on **3002** rather than the Next.js default, because the WhatsApp
> platform it talks to occupies 3000. Change both together if you prefer other
> ports — `WA_PLATFORM_URL` below must point at the platform, not at Élan.

### Environment variables

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/elan?schema=public"
TZ="Asia/Kolkata"

AUTH_SECRET="<paste output of: npx auth secret>"   # Auth.js

NOTIFY_MODE="simulated"          # "live" to actually send WhatsApp messages
WA_PLATFORM_URL="http://localhost:3000"            # the WhatsApp platform, not Élan
WA_PLATFORM_TOKEN="<token your WhatsApp platform accepts>"
CRON_SECRET="<any long random string>"             # guards /api/cron/sweep
```

### Scripts

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start

npx tsx scripts/verify-availability.ts   # 19 assertions on the availability engine — no database needed
npx tsx scripts/sweep-once.ts            # run one notification sweep by hand
```

---

## The surfaces

### 1. Storefront — `/`

A server-rendered shopfront (`app/(site)/page.tsx`) built entirely from tenant data — nothing about Élan is hardcoded in the markup. Hero from the tenant's name, city, and tagline; the service menu grouped by category in catalogue order with duration, deposit, and price; team cards from `Staff`; address, contact, and opening hours (rendered Monday-first, "Closed" where no `OpeningHour` row exists). It reads as a printed price list, which is the same voice as the wizard's running ticket.

### 2. Booking wizard — `/book`

Service → stylist → date/time → contact → confirm. A server component (`app/(site)/book/page.tsx`) renders the client wizard (`components/site/BookingWizard.tsx`); server actions in `app/(site)/book/actions.ts` fetch slots, save the draft, and confirm. The confirmation page lives at `/booking/[ref]`.

The signature UI element is the **running ticket** — a ruled column that fills in as selections are made, like a paper docket at the front desk. "First available" resolves server-side, unioning slots across every stylist who offers the service; the chosen stylist is fixed at confirm.

### 3. Admin dashboard — `/admin/*`

Auth.js v5 credentials login (`lib/auth.ts`, plus root `proxy.ts` — Next 16's rename of `middleware.ts` — protecting `/admin/*` and carrying a `next` param so you land back where you were aiming). Today's diary and stats, a filterable appointments list, accept/cancel/reschedule with inline reschedule, plus management of services, team, shifts, closures, customers, and the message queue. All server actions live in `app/(admin)/admin/actions.ts`; admin data helpers in `lib/admin/`.

The dashboard shares the customer site's palette but reads denser, with a monospace face for times, money, and counts — a tool, not a brochure.

### 4. Automations — the sweep

`vercel.json` runs `/api/cron/sweep` every 15 minutes. The sweep (`lib/notifications/sweep.ts`) picks up due `NotificationJob` rows, resolves template variables against the appointment's *current* state, sends via the configured sender, and records the outcome. `lib/notifications/abandoned.ts` chases stalled drafts. Élan never calls Meta directly — the sender posts to an existing WhatsApp platform that owns tokens and the 24-hour window.

---

<details>
<summary><strong>Architecture — the load-bearing decisions</strong> (click to expand)</summary>

<br>

**Slots are computed, never stored.** A fixed grid can't serve a 45-minute cut and a 3-hour bridal package at once. `lib/availability/core.ts` is pure (no DB, fully testable); `lib/availability/index.ts` queries Prisma and delegates to it. Candidate starts are generated on a 15-minute grid per service duration.

**Buffers belong to the existing appointment.** A booked appointment blocks `[start, end + bufferMin]`. A candidate slot must additionally keep its own buffer clear of other bookings, but may run its cleanup past closing time.

**Staff schedules are intersected with salon opening hours**, and split shifts (lunch breaks) leave a real hole in the day. Times are stored in UTC, computed in the tenant's timezone (`Asia/Kolkata`) — 10:00 AM IST is stored as 04:30 UTC. Same-day bookings respect a 60-minute minimum lead time.

**`@@unique([staffId, startsAt])` is the real guard against double-booking.** Slots are revalidated server-side at confirm, but two people confirming the same slot both pass revalidation; the second hits `P2002` and is sent back to pick again. Reschedule reuses the same availability engine, treating the appointment's own current time as free (so a same-time stylist swap works).

**Price is snapshotted onto the appointment** at creation, so later price changes never rewrite past revenue. **Prices are stored and entered in paise** to match storage exactly and avoid rounding drift.

**Every admin query is scoped by `session.user.tenantId`**, never by a value from the request — that's what stops a tenant boundary being crossed by editing an id in a form.

**The draft row is written the moment a phone number is entered** (the contact step, before confirm). That is the only thing abandoned-booking recovery in the sweep has to work with — reordering the wizard would break it. Recovery only chases people who left a number and didn't book anyway under the same number in the window; `recovered` is set in the same transaction as the job so nobody is chased twice.

**Notification jobs are created at booking time** — four per booking: confirmation and owner alert due immediately, reminder 24h before, review request 2h after the end. The sweep only sends.

**Job lifecycle stays consistent with the appointment.** Cancelling or marking `NO_SHOW` flips pending jobs to `CANCELLED` in the same transaction; completing cancels only the reminder. Rescheduling recalculates each job's `sendAt`. Variables are resolved at *send* time, so a rescheduled appointment sends its new time. Variable order is per-template — `templates.ts` is the single source of truth (`review_request` uses three variables, others four). The sweep re-checks status anyway — two guards, because a reminder to someone who cancelled is the bug an owner remembers.

**Consent is checked at send time, not at booking time.** The contact step carries a WhatsApp opt-in checkbox (default on) that lands on `Customer.whatsappOptIn` — the upsert writes it on every booking, so the latest booking is the current answer. All four jobs are still queued regardless; the sweep is what enforces consent, cancelling customer-bound jobs with `customer opted out` recorded against them in `/admin/messages`. `OWNER_ALERT` is exempt — that one goes to the salon, not the customer. Note the cancellation is terminal: opting back in later does not revive jobs already refused.

**Retries back off and give up.** 4xx fails immediately (our fault); 5xx and 429 retry with exponential backoff to three attempts, then land in `FAILED` with the error visible in `/admin/messages`. `NOTIFY_MODE=simulated` logs what would have been sent; nothing reaches the platform until `live`.

</details>

---

## Layout

```
prisma/schema.prisma        Multi-tenant schema (Tenant, Service, Staff, Appointment,
                            BookingDraft, NotificationJob, AdminUser, …)
prisma/seed.ts              Élan Studio tenant seed
lib/prisma.ts               Shared PrismaClient with the pg driver adapter
lib/availability/           Pure slot engine (core) + Prisma-backed wrapper (index)
lib/booking/                Draft upsert + booking creation
lib/notifications/          templates, sender, sweep, abandoned recovery
lib/admin/                  Admin data helpers (appointments, status, reschedule, closures)
lib/auth.ts                 Auth.js v5 config + requireSession()
lib/tenant.ts, lib/format.ts
app/(site)/                 Storefront home, booking wizard, confirmation
app/(admin)/admin/          Dashboard
app/api/                    Auth.js route + cron sweep endpoint
app/globals.css             Customer site styling
app/admin.css               Dashboard styling (imported by the admin layout only)
proxy.ts                    Auth gate on /admin/* (Next 16's middleware)
components/site/, components/admin/
scripts/                    verify-availability, sweep-once
```

---

## Testing the important paths

- Sign out, hit `/admin/appointments` directly → land on login, return there after signing in.
- Accept then cancel a booking → its pending `NotificationJob` rows read `CANCELLED`.
- Move an appointment onto a taken slot → refused, not double-booked.
- Hide a service, reload `/` and `/book` → it disappears from both the storefront menu and the wizard.
- Book with the opt-in checkbox cleared → the owner alert still sends; the customer's three jobs read `CANCELLED` with `customer opted out`.
- Add a second same-weekday shift for one stylist → the lunch gap appears in the booking flow.
- `npx tsx scripts/sweep-once.ts` → the confirmation and owner alert (due immediately) send on the first run; watch them flip in `/admin/messages`.

---

## Still to wire up

- Abandoned-booking recovery does not consult opt-in — a draft's phone number may have no `Customer` row yet, so there is nothing to consult. `isOptedIn()` in `sender.ts` exists for this and is currently uncalled; wiring it in as-is would block every first-time number, since it returns `false` for unknown phones.
- `HttpSender` body shape must match your WhatsApp platform's actual send endpoint.
- A reply handler, if "reply 1-5" ratings should land somewhere.