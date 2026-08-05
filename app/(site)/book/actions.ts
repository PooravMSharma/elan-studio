"use server";

import { prisma } from "@/lib/prisma";
import { getTenant } from "@/lib/tenant";
import { getAvailability } from "@/lib/availability";
import { createBooking } from "@/lib/booking/create";
import { saveDraft } from "@/lib/booking/draft";
import { formatTime, isValidIndianPhone } from "@/lib/format";

export interface SlotOption {
  startsAt: string;
  label: string;
  staffId: string;
}

export async function getSlotsAction(
  serviceId: string,
  staffId: string,
  date: string
): Promise<SlotOption[]> {
  const tenant = await getTenant();

  const eligible =
    staffId === "any"
      ? (
          await prisma.staffService.findMany({
            where: { serviceId, staff: { tenantId: tenant.id, active: true } },
            select: { staffId: true },
          })
        ).map((r) => r.staffId)
      : [staffId];

  const seen = new Map<number, SlotOption>();

  for (const id of eligible) {
    const slots = await getAvailability(prisma, {
      tenantId: tenant.id,
      serviceId,
      staffId: id,
      date,
    });
    for (const slot of slots) {
      const key = slot.startsAt.getTime();
      if (!seen.has(key)) {
        seen.set(key, {
          startsAt: slot.startsAt.toISOString(),
          label: formatTime(slot.startsAt, tenant.timezone),
          staffId: id,
        });
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function saveDraftAction(input: {
  draftId?: string;
  serviceId?: string;
  staffId?: string;
  startsAt?: string;
  name?: string;
  phone?: string;
  email?: string;
  step: string;
}): Promise<string> {
  const tenant = await getTenant();
  return saveDraft({
    ...input,
    staffId: input.staffId === "any" ? undefined : input.staffId,
    tenantId: tenant.id,
  });
}

export type ConfirmResult =
  | { ok: true; appointmentId: string }
  | { ok: false; message: string };

export async function confirmBookingAction(input: {
  serviceId: string;
  staffId: string;
  startsAt: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  whatsappOptIn?: boolean;
  draftId?: string;
}): Promise<ConfirmResult> {
  const tenant = await getTenant();

  if (input.name.trim().length < 2) {
    return { ok: false, message: "Enter the name the appointment is for." };
  }
  if (!isValidIndianPhone(input.phone)) {
    return { ok: false, message: "Enter a 10-digit mobile number." };
  }

  const result = await createBooking({ ...input, tenantId: tenant.id });

  if (result.ok) return { ok: true, appointmentId: result.appointmentId };

  const messages: Record<string, string> = {
    SLOT_TAKEN: "That time was just booked. Pick another slot.",
    SLOT_INVALID: "That time is no longer available. Pick another slot.",
    SERVICE_UNAVAILABLE: "That service is no longer offered.",
  };
  return { ok: false, message: messages[result.reason] };
}