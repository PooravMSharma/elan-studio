import type { PrismaClient } from "../generated/prisma/client";
import { DateTime } from "luxon";
import { computeSlots, type Slot, type BusyInterval } from "./core";

export * from "./core";

export interface AvailabilityQuery {
  tenantId: string;
  serviceId: string;
  staffId: string;
  date: string;
  now?: Date;
}

export async function getAvailability(
  prisma: PrismaClient,
  query: AvailabilityQuery
): Promise<Slot[]> {
  const { tenantId, serviceId, staffId, date } = query;
  const now = query.now ?? new Date();

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timezone: true, gridMinutes: true, minLeadMinutes: true },
  });

  const tz = tenant.timezone;

  const service = await prisma.service.findFirstOrThrow({
    where: { id: serviceId, tenantId, active: true },
    select: { durationMin: true, bufferMin: true },
  });

  const offered = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
  });
  if (!offered) return [];

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId, active: true },
    select: { id: true },
  });
  if (!staff) return [];

  const dayStart = DateTime.fromISO(date, { zone: tz }).startOf("day");
  if (!dayStart.isValid) return [];
  const dayEnd = dayStart.endOf("day");
  const weekday = dayStart.weekday % 7;

  const [schedules, salonHours, timeOff, appointments] = await Promise.all([
    prisma.staffSchedule.findMany({
      where: { tenantId, staffId, weekday },
      select: { startMinute: true, endMinute: true },
      orderBy: { startMinute: "asc" },
    }),
    prisma.openingHour.findMany({
      where: { tenantId, weekday },
      select: { startMinute: true, endMinute: true },
    }),
    prisma.timeOff.findMany({
      where: {
        tenantId,
        OR: [{ staffId }, { staffId: null }],
        startsAt: { lt: dayEnd.toJSDate() },
        endsAt: { gt: dayStart.toJSDate() },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        staffId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { lt: dayEnd.toJSDate() },
        endsAt: { gt: dayStart.toJSDate() },
      },
      select: { startsAt: true, endsAt: true, service: { select: { bufferMin: true } } },
    }),
  ]);

  if (schedules.length === 0) return [];
  if (salonHours.length === 0) return [];

  const workingWindows = intersectWindows(schedules, salonHours);
  if (workingWindows.length === 0) return [];

  const busy: BusyInterval[] = [
    ...timeOff.map((t) => ({ start: t.startsAt, end: t.endsAt })),
    ...appointments.map((a) => ({
      start: a.startsAt,
      end: new Date(a.endsAt.getTime() + a.service.bufferMin * 60_000),
    })),
  ];

  return computeSlots({
    date,
    timezone: tz,
    service,
    workingWindows,
    busy,
    now,
    options: {
      gridMinutes: tenant.gridMinutes,
      minLeadMinutes: tenant.minLeadMinutes,
    },
  });
}

type Window = { startMinute: number; endMinute: number };

export function intersectWindows(a: Window[], b: Window[]): Window[] {
  const out: Window[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.startMinute, y.startMinute);
      const end = Math.min(x.endMinute, y.endMinute);
      if (end > start) out.push({ startMinute: start, endMinute: end });
    }
  }
  return out.sort((p, q) => p.startMinute - q.startMinute);
}