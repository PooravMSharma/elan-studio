import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import StaffEditor, {
  type StaffRow,
  type TimeOffRow,
} from "@/components/admin/StaffEditor";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  await requireSession();
  const tenant = await getTenant();

  const [staff, services, timeOff] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId: tenant.id },
      include: { services: true, schedules: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.timeOff.findMany({
      where: { tenantId: tenant.id, endsAt: { gte: new Date() } },
      include: { staff: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const staffRows: StaffRow[] = staff.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    title: m.title,
    bio: m.bio,
    active: m.active,
    serviceIds: m.services.map((s) => s.serviceId),
    schedules: m.schedules.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
    })),
  }));

  const fmt = (d: Date) =>
    DateTime.fromJSDate(d).setZone(tenant.timezone).toFormat("d LLL, h:mm a");

  const timeOffRows: TimeOffRow[] = timeOff.map((t) => ({
    id: t.id,
    staffId: t.staffId,
    staffName: t.staff?.name ?? null,
    startsAt: fmt(t.startsAt),
    endsAt: fmt(t.endsAt),
    reason: t.reason,
  }));

  return (
    <>
      <header className="page__head">
        <div>
          <p className="eyebrow">Roster</p>
          <h1>Team</h1>
        </div>
      </header>
      <StaffEditor staff={staffRows} services={services} timeOff={timeOffRows} />
    </>
  );
}