import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  BOOKING_CONFIRMATION: "Confirmation",
  APPOINTMENT_REMINDER: "Reminder",
  OWNER_ALERT: "Owner alert",
  REVIEW_REQUEST: "Review request",
  ABANDONED_RECOVERY: "Unfinished booking",
};

export default async function MessagesPage() {
  await requireSession();
  const tenant = await getTenant();

  const [jobs, counts] = await Promise.all([
    prisma.notificationJob.findMany({
      where: { tenantId: tenant.id },
      include: {
        appointment: { include: { customer: { select: { name: true } } } },
        draft: { select: { name: true } },
      },
      orderBy: { sendAt: "desc" },
      take: 100,
    }),
    prisma.notificationJob.groupBy({
      by: ["status"],
      where: { tenantId: tenant.id },
      _count: true,
    }),
  ]);

  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0;

  return (
    <>
      <header className="page__head">
        <div>
          <p className="eyebrow">Automations</p>
          <h1>Messages</h1>
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <span className="stat__value mono">{countFor("PENDING")}</span>
          <span className="stat__label">queued</span>
        </div>
        <div className="stat">
          <span className="stat__value mono">{countFor("SENT")}</span>
          <span className="stat__label">sent</span>
        </div>
        <div className="stat">
          <span className="stat__value mono">{countFor("FAILED")}</span>
          <span className="stat__label">failed</span>
        </div>
        <div className="stat">
          <span className="stat__value mono">{countFor("CANCELLED")}</span>
          <span className="stat__label">cancelled</span>
        </div>
      </section>

      {jobs.length === 0 ? (
        <p className="empty">
          Nothing queued yet. Messages appear here as soon as a booking comes in.
        </p>
      ) : (
        <section className="rows">
          {jobs.map((job) => (
            <div key={job.id} className={`row row--${job.status.toLowerCase()}`}>
              <div className="row__time">
                <span className="mono">
                  {DateTime.fromJSDate(job.sendAt)
                    .setZone(tenant.timezone)
                    .toFormat("d LLL, h:mm a")}
                </span>
                <span className="row__date">
                  {job.status === "SENT" ? "sent" : "due"}
                </span>
              </div>

              <div className="row__what">
                <span className="row__name">{LABELS[job.type] ?? job.type}</span>
                <span className="row__staff">
                  {job.appointment?.customer.name ?? job.draft?.name ?? "—"}
                </span>
              </div>

              <div className="row__money">
                {job.attempts > 0 && (
                  <span className="mono">{job.attempts} attempts</span>
                )}
              </div>

              <div className="row__status">
                <span className={`tag tag--${job.status.toLowerCase()}`}>
                  {job.status.toLowerCase()}
                </span>
              </div>

              <div />

              {job.lastError && (
                <p className="row__error">{job.lastError}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}