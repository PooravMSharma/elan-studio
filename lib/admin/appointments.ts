import { DateTime } from "luxon";
import { prisma } from "../prisma";
import { getAvailability } from "../availability";

export type AdminActionResult =
  | { ok: true }
  | { ok: false; message: string };

const CANCELLED_STATUSES = ["CANCELLED", "NO_SHOW"] as const;

export async function setAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
): Promise<AdminActionResult> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    select: { id: true },
  });
  if (!appointment) return { ok: false, message: "Appointment not found." };

  const killJobs = (CANCELLED_STATUSES as readonly string[]).includes(status);

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status },
    });

    if (killJobs) {
      await tx.notificationJob.updateMany({
        where: { appointmentId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }

    if (status === "COMPLETED") {
      await tx.notificationJob.updateMany({
        where: {
          appointmentId,
          status: "PENDING",
          type: "APPOINTMENT_REMINDER",
        },
        data: { status: "CANCELLED" },
      });
    }
  });

  return { ok: true };
}

export async function rescheduleAppointment(
  tenantId: string,
  appointmentId: string,
  newStartIso: string,
  newStaffId?: string
): Promise<AdminActionResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timezone: true },
  });

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    include: { service: { select: { id: true, durationMin: true } } },
  });
  if (!appointment) return { ok: false, message: "Appointment not found." };

  const staffId = newStaffId ?? appointment.staffId;
  const start = DateTime.fromISO(newStartIso).setZone(tenant.timezone);
  if (!start.isValid) return { ok: false, message: "That date and time isn't valid." };

  const slots = await getAvailability(prisma, {
    tenantId,
    serviceId: appointment.service.id,
    staffId,
    date: start.toISODate()!,
  });

  const free =
    slots.some((s) => s.startsAt.getTime() === start.toJSDate().getTime()) ||
    start.toJSDate().getTime() === appointment.startsAt.getTime();

  if (!free) return { ok: false, message: "That slot isn't free. Pick another." };

  const endsAt = start.plus({ minutes: appointment.service.durationMin });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          staffId,
          startsAt: start.toJSDate(),
          endsAt: endsAt.toJSDate(),
        },
      });

      await tx.notificationJob.updateMany({
        where: {
          appointmentId,
          status: "PENDING",
          type: "APPOINTMENT_REMINDER",
        },
        data: { sendAt: start.minus({ hours: 24 }).toJSDate() },
      });

      await tx.notificationJob.updateMany({
        where: { appointmentId, status: "PENDING", type: "REVIEW_REQUEST" },
        data: { sendAt: endsAt.plus({ hours: 2 }).toJSDate() },
      });
    });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { ok: false, message: "That slot was taken. Pick another." };
    }
    throw e;
  }

  return { ok: true };
}

export async function blockDates(
  tenantId: string,
  startsAt: string,
  endsAt: string,
  reason: string,
  staffId?: string
): Promise<AdminActionResult> {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!(start < end)) return { ok: false, message: "The end must be after the start." };

  await prisma.timeOff.create({
    data: { tenantId, staffId: staffId ?? null, startsAt: start, endsAt: end, reason },
  });
  return { ok: true };
}