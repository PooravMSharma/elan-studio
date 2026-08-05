import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireSession();
  const tenant = await getTenant();

  const customers = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    include: {
      appointments: {
        include: { service: true },
        orderBy: { startsAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <header className="page__head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Customers</h1>
        </div>
      </header>

      {customers.length === 0 ? (
        <p className="empty">No customers yet. They&rsquo;re created on first booking.</p>
      ) : (
        <section className="rows">
          {customers.map((c) => {
            const kept = c.appointments.filter((a) => a.status === "COMPLETED");
            const spend = kept.reduce((sum, a) => sum + a.priceMinor, 0);
            const last = c.appointments[0];
            return (
              <details key={c.id} className="customer">
                <summary>
                  <span className="customer__name">{c.name}</span>
                  <a className="mono" href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}>
                    {c.phone}
                  </a>
                  <span className="mono">{c.appointments.length} visits</span>
                  <span className="mono">{formatMoney(spend, tenant.currency)}</span>
                  {c.appointments.length > 1 && <span className="tag">returning</span>}
                </summary>
                <ol className="history">
                  {c.appointments.map((a) => (
                    <li key={a.id}>
                      <span className="mono">
                        {DateTime.fromJSDate(a.startsAt)
                          .setZone(tenant.timezone)
                          .toFormat("d LLL yyyy, h:mm a")}
                      </span>
                      <span>{a.service.name}</span>
                      <span className={`tag tag--${a.status.toLowerCase()}`}>
                        {a.status.replace("_", " ").toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ol>
                {last && (
                  <p className="note">
                    Last seen{" "}
                    {DateTime.fromJSDate(last.startsAt)
                      .setZone(tenant.timezone)
                      .toRelative()}
                    .
                  </p>
                )}
              </details>
            );
          })}
        </section>
      )}
    </>
  );
}