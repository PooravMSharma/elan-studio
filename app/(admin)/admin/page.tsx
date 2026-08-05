import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import { formatMoney } from "@/lib/format";
import AppointmentRow, { type Row } from "@/components/admin/AppointmentRow";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  await requireSession();
  const tenant = await getTenant();
  const tz = tenant.timezone;

  const now = DateTime.now().setZone(tz);
  const dayStart = now.startOf("day");
  const dayEnd = now.endOf("day");

  const [appointments, staff, monthStats, pendingJobs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        startsAt: { gte: dayStart.toJSDate(), lte: dayEnd.toJSDate() },
      },
      include: { customer: true, service: true, staff: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.staff.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.appointment.aggregate({
      where: {
        tenantId: tenant.id,
        status: { in: ["CONFIRMED", "COMPLETED"] },
        startsAt: { gte: now.startOf("month").toJSDate() },
      },
      _sum: { priceMinor: true },
      _count: true,
    }),
    prisma.notificationJob.count({
      where: { tenantId: tenant.id, status: "PENDING" },
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

  const awaiting = rows.filter((r) => r.status === "PENDING").length;

  return (
    <>
      <header className="page__head">
        <div>
          <p className="eyebrow">{now.toFormat("cccc d LLLL")}</p>
          <h1>Today</h1>
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <span className="stat__value mono">{rows.length}</span>
          <span className="stat__label">appointments today</span>
        </div>
        <div className="stat">
          <span className="stat__value mono">{awaiting}</span>
          <span className="stat__label">awaiting your response</span>
        </div>
        <div className="stat">
          <span className="stat__value mono">
            {formatMoney(monthStats._sum.priceMinor ?? 0, tenant.currency)}
          </span>
          <span className="stat__label">booked this month</span>
        </div>
        <div className="stat">
          <span className="stat__value mono">{pendingJobs}</span>
          <span className="stat__label">messages queued</span>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="empty">
          Nothing booked today. New bookings appear here the moment they come in.
        </p>
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