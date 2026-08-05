import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTenant } from "@/lib/tenant";
import { formatFullWhen, formatMoney, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const tenant = await getTenant();

  const appointment = await prisma.appointment.findFirst({
    where: { id: ref, tenantId: tenant.id },
    include: { service: true, staff: true, customer: true },
  });

  if (!appointment) notFound();

  const waText = encodeURIComponent(
    `Hi ${tenant.name}, this is ${appointment.customer.name} about my ${appointment.service.name} booking.`
  );
  const waNumber = (tenant.whatsapp ?? "").replace(/\D/g, "");

  return (
    <main className="confirm">
      <p className="eyebrow">Booked</p>
      <h1>
        See you {formatFullWhen(appointment.startsAt, tenant.timezone)}.
      </h1>
      <p className="lede">
        A confirmation is on its way to {appointment.customer.phone}. We&rsquo;ll
        remind you the day before.
      </p>

      <dl className="receipt">
        <div>
          <dt>Service</dt>
          <dd>{appointment.service.name}</dd>
        </div>
        <div>
          <dt>With</dt>
          <dd>
            {appointment.staff.name}
            {appointment.staff.title ? `, ${appointment.staff.title}` : ""}
          </dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{formatDuration(appointment.service.durationMin)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(appointment.priceMinor, tenant.currency)}</dd>
        </div>
        {appointment.depositStatus === "PENDING" && (
          <div>
            <dt>Deposit due</dt>
            <dd>{formatMoney(appointment.depositMinor, tenant.currency)}</dd>
          </div>
        )}
      </dl>

      <address className="where">
        {tenant.addressL1}
        {tenant.addressL2 ? `, ${tenant.addressL2}` : ""}
        <br />
        {tenant.city}
      </address>

      <div className="actions">
        {waNumber && (
          <a className="btn btn--primary" href={`https://wa.me/${waNumber}?text=${waText}`}>
            Message the studio
          </a>
        )}
        <Link className="btn" href="/book">
          Book another
        </Link>
      </div>

      <p className="note">
        Need to change something? Message us and we&rsquo;ll move it.
      </p>
    </main>
  );
}