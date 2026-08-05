import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBookableCatalogue } from "@/lib/tenant";
import { formatMoney, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatMinuteOfDay(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

export default async function HomePage() {
  const { tenant, services, staff } = await getBookableCatalogue();

  const openingHours = await prisma.openingHour.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });

  // Group services by category, preserving the catalogue order.
  const categories: { name: string; services: typeof services }[] = [];
  for (const service of services) {
    let group = categories.find((c) => c.name === service.category);
    if (!group) {
      group = { name: service.category, services: [] };
      categories.push(group);
    }
    group.services.push(service);
  }

  // Order hours Monday-first (weekday 0 is Sunday in storage).
  const hoursByDay = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    ranges: openingHours
      .filter((h) => h.weekday === weekday)
      .map((h) => `${formatMinuteOfDay(h.startMinute)} – ${formatMinuteOfDay(h.endMinute)}`),
  }));

  return (
    <main className="home">
      <section className="hero">
        <p className="eyebrow">{tenant.city}</p>
        <h1>{tenant.name}</h1>
        {tenant.tagline && <p className="hero__lede">{tenant.tagline}</p>}
        <div className="hero__actions">
          <Link href="/book" className="btn btn--primary">
            Book an appointment
          </Link>
          <a href="#services" className="btn">
            See the menu
          </a>
        </div>
      </section>

      <section id="services" className="section">
        <header className="section__head">
          <p className="eyebrow">The menu</p>
          <h2>Services</h2>
        </header>
        {categories.map((category) => (
          <div key={category.name} className="menu-group">
            <h3 className="menu-group__name">{category.name}</h3>
            <ul className="menu-list">
              {category.services.map((service) => (
                <li key={service.id} className="menu-item">
                  <div className="menu-item__main">
                    <span className="menu-item__name">{service.name}</span>
                    {service.description && (
                      <span className="menu-item__desc">{service.description}</span>
                    )}
                    <span className="menu-item__meta">
                      {formatDuration(service.durationMin)}
                      {service.requiresDeposit && (
                        <em> · {formatMoney(service.depositMinor, tenant.currency)} deposit</em>
                      )}
                    </span>
                  </div>
                  <span className="menu-item__price">
                    {formatMoney(service.priceMinor, tenant.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="section">
        <header className="section__head">
          <p className="eyebrow">Behind the chair</p>
          <h2>The team</h2>
        </header>
        <div className="team">
          {staff.map((member) => (
            <article key={member.id} className="team-card">
              <h3 className="team-card__name">{member.name}</h3>
              {member.title && <p className="team-card__title">{member.title}</p>}
              {member.bio && <p className="team-card__bio">{member.bio}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="section visit">
        <div>
          <header className="section__head">
            <p className="eyebrow">Find us</p>
            <h2>Visit</h2>
          </header>
          <address className="visit__address">
            {tenant.addressL1 && <span>{tenant.addressL1}</span>}
            {tenant.addressL2 && <span>{tenant.addressL2}</span>}
            {tenant.city && <span>{tenant.city}</span>}
          </address>
          <dl className="visit__contact">
            {tenant.phone && (
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${tenant.phone}`}>{tenant.phone}</a>
                </dd>
              </div>
            )}
            {tenant.email && (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${tenant.email}`}>{tenant.email}</a>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="hours">
          <h3 className="hours__title">Opening hours</h3>
          <dl>
            {hoursByDay.map(({ weekday, ranges }) => (
              <div key={weekday} className="hours__row">
                <dt>{WEEKDAYS[weekday]}</dt>
                <dd>{ranges.length ? ranges.join(", ") : "Closed"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="home__foot">
        <p>{tenant.name}</p>
        <Link href="/book" className="btn btn--primary">
          Book now
        </Link>
      </footer>
    </main>
  );
}
