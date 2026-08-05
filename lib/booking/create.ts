import { DateTime } from "luxon";
import { prisma } from "../prisma";
import { getAvailability } from "../availability";
import { normalisePhone } from "../format";

export interface CreateBookingInput {
  tenantId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  whatsappOptIn?: boolean;
  draftId?: string;
}

export type CreateBookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: "SLOT_TAKEN" | "SLOT_INVALID" | "SERVICE_UNAVAILABLE" };

const REMINDER_LEAD_HOURS = 24;
const REVIEW_DELAY_HOURS = 2;

export async function createBooking(
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { id: true, timezone: true },
  });

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, tenantId: tenant.id, active: true },
    select: {
      id: true,
      name: true,
      durationMin: true,
      priceMinor: true,
      requiresDeposit: true,
      depositMinor: true,
    },
  });
  if (!service) return { ok: false, reason: "SERVICE_UNAVAILABLE" };

  const start = DateTime.fromISO(input.startsAt).setZone(tenant.timezone);
  if (!start.isValid) return { ok: false, reason: "SLOT_INVALID" };

  const date = start.toISODate()!;
  const slots = await getAvailability(prisma, {
    tenantId: tenant.id,
    serviceId: service.id,
    staffId: input.staffId,
    date,
  });

  const stillFree = slots.some(
    (s) => s.startsAt.getTime() === start.toJSDate().getTime()
  );
  if (!stillFree) return { ok: false, reason: "SLOT_TAKEN" };

  const endsAt = start.plus({ minutes: service.durationMin });
  const phone = normalisePhone(input.phone);

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone } },
        update: {
          name: input.name,
          whatsappOptIn: input.whatsappOptIn ?? true,
          ...(input.email ? { email: input.email } : {}),
        },
        create: {
          tenantId: tenant.id,
          name: input.name,
          phone,
          email: input.email ?? null,
          whatsappOptIn: input.whatsappOptIn ?? true,
        },
      });

      const created = await tx.appointment.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          staffId: input.staffId,
          serviceId: service.id,
          startsAt: start.toJSDate(),
          endsAt: endsAt.toJSDate(),
          status: "PENDING",
          priceMinor: service.priceMinor,
          depositMinor: service.requiresDeposit ? service.depositMinor : 0,
          depositStatus: service.requiresDeposit ? "PENDING" : "NOT_REQUIRED",
          notes: input.notes ?? null,
        },
      });

      if (input.draftId) {
        await tx.bookingDraft.updateMany({
          where: { id: input.draftId, tenantId: tenant.id },
          data: { converted: true },
        });
      }

      const now = new Date();
      const reminderAt = start.minus({ hours: REMINDER_LEAD_HOURS });
      const jobs = [
        { type: "BOOKING_CONFIRMATION" as const, sendAt: now },
        { type: "OWNER_ALERT" as const, sendAt: now },
        {
          type: "APPOINTMENT_REMINDER" as const,
          sendAt: reminderAt > DateTime.now() ? reminderAt.toJSDate() : now,
        },
        {
          type: "REVIEW_REQUEST" as const,
          sendAt: endsAt.plus({ hours: REVIEW_DELAY_HOURS }).toJSDate(),
        },
      ];

      await tx.notificationJob.createMany({
        data: jobs.map((j) => ({
          tenantId: tenant.id,
          appointmentId: created.id,
          type: j.type,
          sendAt: j.sendAt,
          payload: {
            customerName: input.name,
            phone,
            serviceName: service.name,
            startsAt: start.toISO(),
          },
        })),
      });

      return created;
    });

    return { ok: true, appointmentId: appointment.id };
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { ok: false, reason: "SLOT_TAKEN" };
    }
    throw e;
  }
}