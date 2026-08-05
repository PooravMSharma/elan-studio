import { prisma } from "../prisma";
import { normalisePhone } from "../format";

export interface DraftInput {
  tenantId: string;
  draftId?: string;
  serviceId?: string;
  staffId?: string;
  startsAt?: string;
  name?: string;
  phone?: string;
  email?: string;
  step: string;
}

export async function saveDraft(input: DraftInput): Promise<string> {
  const data = {
    tenantId: input.tenantId,
    serviceId: input.serviceId ?? null,
    staffId: input.staffId ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    name: input.name ?? null,
    phone: input.phone ? normalisePhone(input.phone) : null,
    email: input.email ?? null,
    step: input.step,
  };

  if (input.draftId) {
    const existing = await prisma.bookingDraft.findFirst({
      where: { id: input.draftId, tenantId: input.tenantId, converted: false },
      select: { id: true },
    });
    if (existing) {
      await prisma.bookingDraft.update({ where: { id: existing.id }, data });
      return existing.id;
    }
  }

  const created = await prisma.bookingDraft.create({ data });
  return created.id;
}