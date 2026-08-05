import { prisma } from "./prisma";

export const TENANT_SLUG = process.env.TENANT_SLUG ?? "elan-studio";

export async function getTenant() {
  return prisma.tenant.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });
}

export async function getBookableCatalogue() {
  const tenant = await getTenant();

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      durationMin: true,
      priceMinor: true,
      requiresDeposit: true,
      depositMinor: true,
      staff: { select: { staffId: true } },
    },
  });

  const staff = await prisma.staff.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, title: true, bio: true, photoUrl: true },
  });

  return {
    tenant,
    staff,
    services: services.map((s) => ({
      ...s,
      staffIds: s.staff.map((x) => x.staffId),
      staff: undefined,
    })),
  };
}