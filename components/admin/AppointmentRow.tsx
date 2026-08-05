"use client";

import { useState, useTransition } from "react";
import { updateStatusAction, rescheduleAction } from "@/app/(admin)/admin/actions";

export type Row = {
  id: string;
  time: string;
  dateLabel: string;
  isoLocal: string;
  status: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  staffName: string;
  staffId: string;
  price: string;
  depositStatus: string;
};

const NEXT_ACTIONS: Record<string, { label: string; status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" }[]> = {
  PENDING: [
    { label: "Accept", status: "CONFIRMED" },
    { label: "Cancel", status: "CANCELLED" },
  ],
  CONFIRMED: [
    { label: "Mark done", status: "COMPLETED" },
    { label: "No-show", status: "NO_SHOW" },
    { label: "Cancel", status: "CANCELLED" },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export default function AppointmentRow({
  row,
  staff,
}: {
  row: Row;
  staff: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(row.isoLocal);
  const [withWhom, setWithWhom] = useState(row.staffId);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message);
      else setOpen(false);
    });
  }

  return (
    <div className={`row row--${row.status.toLowerCase()}`}>
      <div className="row__time">
        <span className="mono">{row.time}</span>
        <span className="row__date">{row.dateLabel}</span>
      </div>

      <div className="row__who">
        <span className="row__name">{row.customerName}</span>
        <a className="row__phone mono" href={`https://wa.me/${row.customerPhone.replace(/\D/g, "")}`}>
          {row.customerPhone}
        </a>
      </div>

      <div className="row__what">
        <span>{row.serviceName}</span>
        <span className="row__staff">with {row.staffName}</span>
      </div>

      <div className="row__money">
        <span className="mono">{row.price}</span>
        {row.depositStatus === "PENDING" && <span className="tag tag--warn">deposit due</span>}
      </div>

      <div className="row__status">
        <span className={`tag tag--${row.status.toLowerCase()}`}>
          {row.status.replace("_", " ").toLowerCase()}
        </span>
      </div>

      <div className="row__actions">
        {NEXT_ACTIONS[row.status]?.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={pending}
            onClick={() => run(() => updateStatusAction(row.id, action.status))}
          >
            {action.label}
          </button>
        ))}
        {(row.status === "PENDING" || row.status === "CONFIRMED") && (
          <button type="button" onClick={() => setOpen((v) => !v)} disabled={pending}>
            {open ? "Close" : "Move"}
          </button>
        )}
      </div>

      {open && (
        <div className="row__reschedule">
          <label>
            New time
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
          <label>
            With
            <select value={withWhom} onChange={(e) => setWithWhom(e.target.value)}>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rescheduleAction(row.id, when, withWhom))}
          >
            {pending ? "Moving…" : "Move appointment"}
          </button>
        </div>
      )}

      {error && (
        <p className="row__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}