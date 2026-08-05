"use client";

import { useState, useTransition } from "react";
import {
  saveStaffAction,
  saveScheduleAction,
  removeScheduleAction,
  blockDatesAction,
  removeTimeOffAction,
} from "@/app/(admin)/admin/actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type StaffRow = {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  active: boolean;
  serviceIds: string[];
  schedules: { id: string; weekday: number; startMinute: number; endMinute: number }[];
};

export type TimeOffRow = {
  id: string;
  staffId: string | null;
  staffName: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export default function StaffEditor({
  staff,
  services,
  timeOff,
}: {
  staff: StaffRow[];
  services: { id: string; name: string }[];
  timeOff: TimeOffRow[];
}) {
  const [editing, setEditing] = useState<StaffRow>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const [shift, setShift] = useState({ weekday: 1, start: "10:00", end: "19:00" });
  const [block, setBlock] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
    staffId: "",
  });

  function saveMember() {
    if (!editing) return;
    setError(undefined);
    startTransition(async () => {
      const result = await saveStaffAction({
        id: editing.id || undefined,
        name: editing.name,
        slug: editing.slug || editing.name.toLowerCase().replace(/\s+/g, "-"),
        title: editing.title ?? "",
        bio: editing.bio ?? "",
        active: editing.active,
        serviceIds: editing.serviceIds,
      });
      if (result.ok) setEditing(undefined);
      else setError(result.message);
    });
  }

  return (
    <>
      <div className="toolbar">
        <button
          type="button"
          onClick={() =>
            setEditing({
              id: "",
              name: "",
              slug: "",
              title: "",
              bio: "",
              active: true,
              serviceIds: [],
              schedules: [],
            })
          }
        >
          Add a team member
        </button>
      </div>

      {editing && (
        <div className="editor">
          <h2>{editing.id ? `Edit ${editing.name}` : "New team member"}</h2>
          <div className="editor__grid">
            <label>
              Name
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              Title
              <input
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Senior Stylist"
              />
            </label>
          </div>

          <label className="editor__wide">
            Bio
            <textarea
              rows={2}
              value={editing.bio ?? ""}
              onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
            />
          </label>

          <fieldset className="services">
            <legend>Services they offer</legend>
            {services.map((s) => (
              <label key={s.id} className="check">
                <input
                  type="checkbox"
                  checked={editing.serviceIds.includes(s.id)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      serviceIds: e.target.checked
                        ? [...editing.serviceIds, s.id]
                        : editing.serviceIds.filter((id) => id !== s.id),
                    })
                  }
                />
                {s.name}
              </label>
            ))}
          </fieldset>

          <label className="check">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />
            Taking bookings
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="editor__actions">
            <button type="button" onClick={saveMember} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="ghost" onClick={() => setEditing(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="rows">
        {staff.map((m) => (
          <details key={m.id} className={`customer${m.active ? "" : " row--off"}`}>
            <summary>
              <span className="customer__name">{m.name}</span>
              <span>{m.title}</span>
              <span className="mono">{m.schedules.length} shifts</span>
              {!m.active && <span className="tag">not bookable</span>}
            </summary>

            <div className="shifts">
              {m.schedules
                .slice()
                .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
                .map((s) => (
                  <div key={s.id} className="shift">
                    <span>{DAYS[s.weekday]}</span>
                    <span className="mono">
                      {toTime(s.startMinute)} – {toTime(s.endMinute)}
                    </span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() =>
                        startTransition(() => {
                          void removeScheduleAction(s.id);
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}

              <div className="shift shift--new">
                <select
                  value={shift.weekday}
                  onChange={(e) => setShift({ ...shift, weekday: Number(e.target.value) })}
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={shift.start}
                  onChange={(e) => setShift({ ...shift, start: e.target.value })}
                />
                <input
                  type="time"
                  value={shift.end}
                  onChange={(e) => setShift({ ...shift, end: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await saveScheduleAction({
                        staffId: m.id,
                        weekday: shift.weekday,
                        startMinute: toMinutes(shift.start),
                        endMinute: toMinutes(shift.end),
                      });
                      if (!result.ok) setError(result.message);
                    })
                  }
                >
                  Add shift
                </button>
              </div>

              <p className="note">
                Add two shifts on the same day to leave a lunch break in between.
              </p>
            </div>

            <div className="editor__actions">
              <button type="button" onClick={() => setEditing(m)}>
                Edit details
              </button>
            </div>
          </details>
        ))}
      </section>

      <h2 className="section__title">Closures and time off</h2>

      <div className="editor">
        <div className="editor__grid">
          <label>
            From
            <input
              type="datetime-local"
              value={block.startsAt}
              onChange={(e) => setBlock({ ...block, startsAt: e.target.value })}
            />
          </label>
          <label>
            Until
            <input
              type="datetime-local"
              value={block.endsAt}
              onChange={(e) => setBlock({ ...block, endsAt: e.target.value })}
            />
          </label>
          <label>
            Who
            <select
              value={block.staffId}
              onChange={(e) => setBlock({ ...block, staffId: e.target.value })}
            >
              <option value="">Whole studio</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason
            <input
              value={block.reason}
              onChange={(e) => setBlock({ ...block, reason: e.target.value })}
              placeholder="Diwali"
            />
          </label>
        </div>
        <div className="editor__actions">
          <button
            type="button"
            disabled={pending || !block.startsAt || !block.endsAt}
            onClick={() =>
              startTransition(async () => {
                const result = await blockDatesAction(block);
                if (result.ok) setBlock({ startsAt: "", endsAt: "", reason: "", staffId: "" });
                else setError(result.message);
              })
            }
          >
            Block these dates
          </button>
        </div>
      </div>

      <section className="rows">
        {timeOff.map((t) => (
          <div key={t.id} className="row">
            <div className="row__what">
              <span className="row__name">{t.reason || "Closed"}</span>
              <span className="row__staff">{t.staffName ?? "Whole studio"}</span>
            </div>
            <div className="row__money">
              <span className="mono">
                {t.startsAt} → {t.endsAt}
              </span>
            </div>
            <div className="row__actions">
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    void removeTimeOffAction(t.id);
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}