"use client";

import { useState, useTransition } from "react";
import { saveServiceAction, toggleServiceAction } from "@/app/(admin)/admin/actions";

export type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  durationMin: number;
  bufferMin: number;
  priceMinor: number;
  active: boolean;
  requiresDeposit: boolean;
  depositMinor: number;
};

const BLANK: ServiceRow = {
  id: "",
  name: "",
  slug: "",
  category: "",
  description: "",
  durationMin: 45,
  bufferMin: 15,
  priceMinor: 0,
  active: true,
  requiresDeposit: false,
  depositMinor: 0,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ServiceEditor({ services }: { services: ServiceRow[] }) {
  const [editing, setEditing] = useState<ServiceRow>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    if (!editing) return;
    setError(undefined);
    startTransition(async () => {
      const result = await saveServiceAction({
        id: editing.id || undefined,
        name: editing.name,
        slug: editing.slug || slugify(editing.name),
        category: editing.category,
        description: editing.description ?? "",
        durationMin: Number(editing.durationMin),
        bufferMin: Number(editing.bufferMin),
        priceMinor: Math.round(Number(editing.priceMinor)),
        active: editing.active,
        requiresDeposit: editing.requiresDeposit,
        depositMinor: Math.round(Number(editing.depositMinor)),
      });
      if (result.ok) setEditing(undefined);
      else setError(result.message);
    });
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" onClick={() => setEditing({ ...BLANK })}>
          Add a service
        </button>
      </div>

      {editing && (
        <div className="editor">
          <h2>{editing.id ? "Edit service" : "New service"}</h2>

          <div className="editor__grid">
            <label>
              Name
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: e.target.value,
                    slug: editing.id ? editing.slug : slugify(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Category
              <input
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="Hair"
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                value={editing.durationMin}
                onChange={(e) =>
                  setEditing({ ...editing, durationMin: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Cleanup buffer
              <input
                type="number"
                value={editing.bufferMin}
                onChange={(e) =>
                  setEditing({ ...editing, bufferMin: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Price in paise
              <input
                type="number"
                value={editing.priceMinor}
                onChange={(e) =>
                  setEditing({ ...editing, priceMinor: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Deposit in paise
              <input
                type="number"
                value={editing.depositMinor}
                disabled={!editing.requiresDeposit}
                onChange={(e) =>
                  setEditing({ ...editing, depositMinor: Number(e.target.value) })
                }
              />
            </label>
          </div>

          <label className="editor__wide">
            Description
            <textarea
              rows={2}
              value={editing.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </label>

          <div className="editor__checks">
            <label className="check">
              <input
                type="checkbox"
                checked={editing.requiresDeposit}
                onChange={(e) =>
                  setEditing({ ...editing, requiresDeposit: e.target.checked })
                }
              />
              Takes a deposit
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              Bookable
            </label>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="editor__actions">
            <button type="button" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save service"}
            </button>
            <button type="button" className="ghost" onClick={() => setEditing(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="rows">
        {services.map((s) => (
          <div key={s.id} className={`row${s.active ? "" : " row--off"}`}>
            <div className="row__what">
              <span className="row__name">{s.name}</span>
              <span className="row__staff">{s.category}</span>
            </div>
            <div className="row__money">
              <span className="mono">
                {s.durationMin} min · ₹{(s.priceMinor / 100).toLocaleString("en-IN")}
              </span>
              {s.requiresDeposit && <span className="tag tag--warn">deposit</span>}
            </div>
            <div className="row__status">
              {!s.active && <span className="tag">hidden</span>}
            </div>
            <div className="row__actions">
              <button type="button" onClick={() => setEditing(s)}>
                Edit
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    void toggleServiceAction(s.id, !s.active);
                  })
                }
              >
                {s.active ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}