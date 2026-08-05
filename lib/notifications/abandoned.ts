import { prisma } from "../prisma";

const STALE_AFTER_MINUTES = 30;
const GIVE_UP_AFTER_HOURS = 48;

/**
 * A draft counts as abandoned when it has a phone number, has not converted
 * into an appointment, and has sat untouched for STALE_AFTER_MINUTES.
 *
 * The phone number is captured at the contact step, before confirmation —
 * which is the whole reason the wizard is ordered the way it is.
 */
export async function queueAbandonedRecoveries(now = new Date()): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);
  const giveUpBefore = new Date(now.getTime() - GIVE_UP_AFTER_HOURS * 3_600_000);

  const drafts = await prisma.bookingDraft.findMany({
    where: {
      converted: false,
      recovered: false,
      phone: { not: null },
      name: { not: null },
      updatedAt: { lt: staleBefore, gt: giveUpBefore },
    },
    select: { id: true, tenantId: true, phone: true, name: true, serviceId: true },
    take: 100,
  });

  let queued = 0;

  for (const draft of drafts) {
    // Don't chase someone who booked anyway under the same number.
    const booked = await prisma.appointment.findFirst({
      where: {
        tenantId: draft.tenantId,
        customer: { phone: draft.phone! },
        createdAt: { gte: giveUpBefore },
      },
      select: { id: true },
    });

    if (booked) {
      await prisma.bookingDraft.update({
        where: { id: draft.id },
        data: { converted: true },
      });
      continue;
    }

    await prisma.$transaction([
      prisma.notificationJob.create({
        data: {
          tenantId: draft.tenantId,
          draftId: draft.id,
          type: "ABANDONED_RECOVERY",
          sendAt: now,
          payload: { phone: draft.phone, name: draft.name },
        },
      }),
      prisma.bookingDraft.update({
        where: { id: draft.id },
        data: { recovered: true },
      }),
    ]);

    queued++;
  }

  return queued;
}