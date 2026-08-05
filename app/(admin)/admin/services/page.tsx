import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import ServiceEditor, { type ServiceRow } from "@/components/admin/ServiceEditor";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  await requireSession();
  const tenant = await getTenant();

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const rows: ServiceRow[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    category: s.category,
    description: s.description,
    durationMin: s.durationMin,
    bufferMin: s.bufferMin,
    priceMinor: s.priceMinor,
    active: s.active,
    requiresDeposit: s.requiresDeposit,
    depositMinor: s.depositMinor,
  }));

  return (
    <>
      <header className="page__head">
        <div>
          <p className="eyebrow">Menu</p>
          <h1>Services</h1>
        </div>
      </header>
      <ServiceEditor services={rows} />
    </>
  );
}