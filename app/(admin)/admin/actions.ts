"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  setAppointmentStatus,
  rescheduleAppointment,
  blockDates,
  type AdminActionResult,
} from "@/lib/admin/appointments";

export async function updateStatusAction(
  appointmentId: string,
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
): Promise<AdminActionResult> {
  const session = await requireSession();
  const result = await setAppointmentStatus(
    session.user.tenantId,
    appointmentId,
    status
  );
  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  return result;
}

export async function rescheduleAction(
  appointmentId: string,
  startsAt: string,
  staffId?: string
): Promise<AdminActionResult> {
  const session = await requireSession();
  const result = await rescheduleAppointment(
    session.user.tenantId,
    appointmentId,
    startsAt,
    staffId
  );
  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  return result;
}

export async function blockDatesAction(input: {
  startsAt: string;
  endsAt: string;
  reason: string;
  staffId?: string;
}): Promise<AdminActionResult> {
  const session = await requireSession();
  const result = await blockDates(
    session.user.tenantId,
    input.startsAt,
    input.endsAt,
    input.reason,
    input.staffId || undefined
  );
  revalidatePath("/admin/staff");
  return result;
}

export async function removeTimeOffAction(id: string): Promise<AdminActionResult> {
  const session = await requireSession();
  await prisma.timeOff.deleteMany({
    where: { id, tenantId: session.user.tenantId },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function saveServiceAction(input: {
  id?: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  durationMin: number;
  bufferMin: number;
  priceMinor: number;
  active: boolean;
  requiresDeposit: boolean;
  depositMinor: number;
}): Promise<AdminActionResult> {
  const session = await requireSession();
  const tenantId = session.user.tenantId;

  if (!input.name.trim()) return { ok: false, message: "Give the service a name." };
  if (input.durationMin <= 0) return { ok: false, message: "Duration must be more than zero." };

  const data = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    category: input.category.trim() || "Other",
    description: input.description?.trim() || null,
    durationMin: input.durationMin,
    bufferMin: input.bufferMin,
    priceMinor: input.priceMinor,
    active: input.active,
    requiresDeposit: input.requiresDeposit,
    depositMinor: input.requiresDeposit ? input.depositMinor : 0,
  };

  try {
    if (input.id) {
      await prisma.service.updateMany({
        where: { id: input.id, tenantId },
        data,
      });
    } else {
      await prisma.service.create({ data: { ...data, tenantId } });
    }
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { ok: false, message: "Another service already uses that slug." };
    }
    throw e;
  }

  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { ok: true };
}

export async function toggleServiceAction(
  id: string,
  active: boolean
): Promise<AdminActionResult> {
  const session = await requireSession();
  await prisma.service.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: { active },
  });
  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { ok: true };
}

export async function saveStaffAction(input: {
  id?: string;
  name: string;
  slug: string;
  title?: string;
  bio?: string;
  active: boolean;
  serviceIds: string[];
}): Promise<AdminActionResult> {
  const session = await requireSession();
  const tenantId = session.user.tenantId;

  if (!input.name.trim()) return { ok: false, message: "Give the team member a name." };

  const data = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    title: input.title?.trim() || null,
    bio: input.bio?.trim() || null,
    active: input.active,
  };

  try {
    const staff = input.id
      ? await prisma.staff.update({ where: { id: input.id }, data })
      : await prisma.staff.create({ data: { ...data, tenantId } });

    await prisma.staffService.deleteMany({ where: { staffId: staff.id } });
    if (input.serviceIds.length) {
      await prisma.staffService.createMany({
        data: input.serviceIds.map((serviceId) => ({
          staffId: staff.id,
          serviceId,
        })),
      });
    }
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { ok: false, message: "Another team member already uses that slug." };
    }
    throw e;
  }

  revalidatePath("/admin/staff");
  revalidatePath("/book");
  return { ok: true };
}

export async function saveScheduleAction(input: {
  staffId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}): Promise<AdminActionResult> {
  const session = await requireSession();
  if (input.endMinute <= input.startMinute) {
    return { ok: false, message: "The finish time must be after the start." };
  }

  const staff = await prisma.staff.findFirst({
    where: { id: input.staffId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!staff) return { ok: false, message: "Team member not found." };

  await prisma.staffSchedule.create({
    data: { ...input, tenantId: session.user.tenantId },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function removeScheduleAction(id: string): Promise<AdminActionResult> {
  const session = await requireSession();
  await prisma.staffSchedule.deleteMany({
    where: { id, tenantId: session.user.tenantId },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}