import { DateTime } from "luxon";
import { getBookableCatalogue } from "@/lib/tenant";
import BookingWizard from "@/components/site/BookingWizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Book an appointment · Élan Studio",
  description:
    "Choose a service, a stylist and a time. Confirmation and reminders come to you on WhatsApp.",
};

export default async function BookPage() {
  const { tenant, services, staff } = await getBookableCatalogue();

  const today = DateTime.now().setZone(tenant.timezone).startOf("day");
  const dates = Array.from({ length: 21 }, (_, i) => {
    const d = today.plus({ days: i });
    return {
      iso: d.toISODate()!,
      weekday: i === 0 ? "Today" : d.toFormat("ccc"),
      day: d.toFormat("d"),
      month: d.toFormat("LLL"),
    };
  });

  return (
    <main className="book">
      <header className="book__head">
        <p className="eyebrow">{tenant.city}</p>
        <h1>Book an appointment</h1>
        <p className="lede">{tenant.tagline}</p>
      </header>

      <BookingWizard
        services={services as never}
        staff={staff}
        dates={dates}
        currency={tenant.currency}
      />
    </main>
  );
}