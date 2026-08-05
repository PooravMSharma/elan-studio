"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getSlotsAction,
  saveDraftAction,
  confirmBookingAction,
  type SlotOption,
} from "@/app/(site)/book/actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  durationMin: number;
  priceMinor: number;
  requiresDeposit: boolean;
  depositMinor: number;
  staffIds: string[];
};

type Staff = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
};

type Props = {
  services: Service[];
  staff: Staff[];
  dates: { iso: string; weekday: string; day: string; month: string }[];
  currency: string;
};

const STEPS = ["Service", "Stylist", "Time", "Details"] as const;

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export default function BookingWizard({
  services,
  staff,
  dates,
  currency,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>();
  const [staffId, setStaffId] = useState<string>();
  const [date, setDate] = useState<string>(dates[0]?.iso);
  const [slot, setSlot] = useState<SlotOption>();
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [draftId, setDraftId] = useState<string>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [optIn, setOptIn] = useState(true);

  const service = useMemo(
    () => services.find((s) => s.id === serviceId),
    [serviceId, services],
  );

  const eligibleStaff = useMemo(
    () => (service ? staff.filter((m) => service.staffIds.includes(m.id)) : []),
    [service, staff],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) {
      map.set(s.category, [...(map.get(s.category) ?? []), s]);
    }
    return [...map.entries()];
  }, [services]);

  useEffect(() => {
    if (step !== 2 || !serviceId || !staffId || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlot(undefined);
    getSlotsAction(serviceId, staffId, date)
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, staffId, date]);

  function persistDraft(
    next: Partial<Record<string, string | undefined>>,
    stepName: string,
  ) {
    startTransition(async () => {
      const id = await saveDraftAction({
        draftId,
        serviceId,
        staffId,
        startsAt: slot?.startsAt,
        name,
        phone,
        email,
        step: stepName,
        ...next,
      });
      setDraftId(id);
    });
  }

  function confirm() {
    if (!serviceId || !slot) return;
    setError(undefined);
    startTransition(async () => {
      const result = await confirmBookingAction({
        serviceId,
        staffId: slot.staffId,
        startsAt: slot.startsAt,
        name,
        phone,
        email: email || undefined,
        draftId,
      });
      if (result.ok) {
        router.push(`/booking/${result.appointmentId}`);
      } else {
        setError(result.message);
        if (result.message.includes("slot")) setStep(2);
      }
    });
  }

  const selectedStaffName =
    slot && staff.find((m) => m.id === slot.staffId)?.name;

  return (
    <div className="wizard">
      <ol className="wizard__index" aria-label="Booking steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`wizard__index-item${i === step ? " is-current" : ""}${i < step ? " is-done" : ""}`}
          >
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard__body">
        <div className="wizard__panel">
          {step === 0 && (
            <section>
              <h2 className="panel__title">What are you booking?</h2>
              {grouped.map(([category, items]) => (
                <div key={category} className="group">
                  <p className="group__label">{category}</p>
                  <div className="cards">
                    {items.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`card${serviceId === s.id ? " is-selected" : ""}${s.category === "Bridal" ? " is-bridal" : ""}`}
                        onClick={() => {
                          setServiceId(s.id);
                          setStaffId(undefined);
                          setSlot(undefined);
                          setStep(1);
                          persistDraft({ serviceId: s.id }, "stylist");
                        }}
                      >
                        <span className="card__name">{s.name}</span>
                        {s.description && (
                          <span className="card__desc">{s.description}</span>
                        )}
                        <span className="card__meta">
                          {duration(s.durationMin)} ·{" "}
                          {money(s.priceMinor, currency)}
                          {s.requiresDeposit && (
                            <em>
                              {" "}
                              · {money(s.depositMinor, currency)} deposit
                            </em>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {step === 1 && service && (
            <section>
              <h2 className="panel__title">Who would you like?</h2>
              <div className="cards">
                <button
                  type="button"
                  className={`card${staffId === "any" ? " is-selected" : ""}`}
                  onClick={() => {
                    setStaffId("any");
                    setStep(2);
                    persistDraft({ staffId: undefined }, "time");
                  }}
                >
                  <span className="card__name">First available</span>
                  <span className="card__desc">
                    We&rsquo;ll match you with whoever is free.
                  </span>
                </button>
                {eligibleStaff.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`card${staffId === m.id ? " is-selected" : ""}`}
                    onClick={() => {
                      setStaffId(m.id);
                      setStep(2);
                      persistDraft({ staffId: m.id }, "time");
                    }}
                  >
                    <span className="card__name">{m.name}</span>
                    {m.title && <span className="card__desc">{m.title}</span>}
                    {m.bio && <span className="card__meta">{m.bio}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="panel__title">Pick a time</h2>
              <div
                className="datestrip"
                role="group"
                aria-label="Choose a date"
              >
                {dates.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    className={`datestrip__day${date === d.iso ? " is-selected" : ""}`}
                    onClick={() => setDate(d.iso)}
                  >
                    <span className="datestrip__weekday">{d.weekday}</span>
                    <span className="datestrip__date">{d.day}</span>
                    <span className="datestrip__month">{d.month}</span>
                  </button>
                ))}
              </div>

              {loadingSlots ? (
                <p className="note">Checking the diary…</p>
              ) : slots.length === 0 ? (
                <p className="note">
                  Nothing free on this day. Try another date, or pick
                  &ldquo;first available&rdquo; to widen the search.
                </p>
              ) : (
                <div className="slots">
                  {slots.map((s) => (
                    <button
                      key={s.startsAt}
                      type="button"
                      className={`slot${slot?.startsAt === s.startsAt ? " is-selected" : ""}`}
                      onClick={() => {
                        setSlot(s);
                        setStep(3);
                        persistDraft({ startsAt: s.startsAt }, "details");
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="panel__title">Where do we reach you?</h2>
              <p className="panel__lede">
                We&rsquo;ll send your confirmation and a reminder on WhatsApp.
              </p>

              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Ananya Sharma"
                />
              </div>

              <div className="field">
                <label htmlFor="phone">Mobile number</label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => persistDraft({}, "details")}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98290 00000"
                />
              </div>

              <div className="field">
                <label htmlFor="email">
                  Email <span className="field__optional">optional</span>
                </label>
                <input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              <label className="check">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                />
                Send my confirmation and reminders on WhatsApp
              </label>

              <button
                type="button"
                className="submit"
                onClick={confirm}
                disabled={pending || !name || !phone}
              >
                {pending ? "Confirming…" : "Confirm appointment"}
              </button>

              {service?.requiresDeposit && (
                <p className="note">
                  A {money(service.depositMinor, currency)} deposit secures this
                  booking. We&rsquo;ll send a payment link on WhatsApp.
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="ticket" aria-label="Your booking so far">
          <p className="ticket__head">Your appointment</p>
          <dl>
            <div className={`ticket__row${service ? " is-set" : ""}`}>
              <dt>Service</dt>
              <dd>{service?.name ?? "—"}</dd>
            </div>
            <div className={`ticket__row${staffId ? " is-set" : ""}`}>
              <dt>With</dt>
              <dd>
                {selectedStaffName ??
                  (staffId === "any"
                    ? "First available"
                    : (staff.find((m) => m.id === staffId)?.name ?? "—"))}
              </dd>
            </div>
            <div className={`ticket__row${slot ? " is-set" : ""}`}>
              <dt>When</dt>
              <dd>
                {slot
                  ? `${dates.find((d) => d.iso === date)?.weekday} ${dates.find((d) => d.iso === date)?.day} ${dates.find((d) => d.iso === date)?.month}, ${slot.label}`
                  : "—"}
              </dd>
            </div>
            <div className={`ticket__row${service ? " is-set" : ""}`}>
              <dt>Length</dt>
              <dd>{service ? duration(service.durationMin) : "—"}</dd>
            </div>
          </dl>
          {service && (
            <p className="ticket__total">
              <span>Total</span>
              <span>{money(service.priceMinor, currency)}</span>
            </p>
          )}
          <p className="ticket__foot">
            Pay at the studio unless a deposit applies.
          </p>
        </aside>
      </div>
    </div>
  );
}
