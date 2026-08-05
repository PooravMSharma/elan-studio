import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import { formatMoney } from "@/lib/format";
import AppointmentRow, { type Row } from "@/components/admin/AppointmentRow";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Awaiting" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireSession();
  const { filter = "upcoming" } = await searchParams;
  const tenant = await getTenant();
  const tz = tenant.timezone;
  const now = new Date();

  const filters: Record<string, Prisma.AppointmentWhereInput> = {
    upcoming: {
      startsAt: { gte: now },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    pending: { status: "PENDING" },
    past: {
      startsAt: { lt: now },
      status: { in: ["COMPLETED", "CONFIRMED"] },
    },
    cancelled: { status: { in: ["CANCELLED", "NO_SHOW"] } },
  };

  const where: Prisma.AppointmentWhereInput = filters[filter] ?? {};

  const [appointments, staff] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId: tenant.id, ...where },
      include: { customer: true, service: true, staff: true },
      orderBy: { startsAt: filter === "past" ? "desc" : "asc" },
      take: 100,
    }),
    prisma.staff.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const rows: Row[] = appointments.map((a) => {
    const start = DateTime.fromJSDate(a.startsAt).setZone(tz);
    return {
      id: a.id,
      time: start.toFormat("h:mm a"),
      dateLabel: start.toFormat("ccc d LLL"),
      isoLocal: start.toFormat("yyyy-LL-dd'T'HH:mm"),
      status: a.status,
      customerName: a.customer.name,
      customerPhone: a.customer.phone,
      serviceName: a.service.name,
      staffName: a.staff.name,
      staffId: a.staffId,
      price: formatMoney(a.priceMinor, tenant.currency),
      depositStatus: a.depositStatus,
    };
  });

  return (
    <>
      <header className="page__head">
        <div>
          <p className="eyebrow">Diary</p>
          <h1>Appointments</h1>
        </div>
      </header>

      <nav className="tabs">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/appointments?filter=${f.key}`}
            className={filter === f.key ? "is-active" : ""}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="empty">Nothing here yet.</p>
      ) : (
        <section className="rows">
          {rows.map((row) => (
            <AppointmentRow key={row.id} row={row} staff={staff} />
          ))}
        </section>
      )}
    </>
  );
}