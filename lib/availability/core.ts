import { DateTime, Interval } from "luxon";

export interface WorkingWindow {
  startMinute: number;
  endMinute: number;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface ServiceShape {
  durationMin: number;
  bufferMin: number;
}

export interface SlotOptions {
  gridMinutes?: number;
  minLeadMinutes?: number;
}

export interface ComputeSlotsInput {
  date: string;
  timezone: string;
  service: ServiceShape;
  workingWindows: WorkingWindow[];
  busy: BusyInterval[];
  now: Date;
  options?: SlotOptions;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  localLabel: string;
}

const DEFAULTS: Required<SlotOptions> = {
  gridMinutes: 15,
  minLeadMinutes: 60,
};

function localMinutesToInterval(
  date: string,
  timezone: string,
  startMinute: number,
  endMinute: number
): Interval {
  const dayStart = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  return Interval.fromDateTimes(
    dayStart.plus({ minutes: startMinute }),
    dayStart.plus({ minutes: endMinute })
  );
}

function subtractAll(windows: Interval[], blockers: Interval[]): Interval[] {
  let remaining = windows;
  for (const blocker of blockers) {
    const next: Interval[] = [];
    for (const window of remaining) {
      next.push(...window.difference(blocker));
    }
    remaining = next;
  }
  return remaining.filter((w) => w.isValid && w.length("minutes") > 0);
}

export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const opts = { ...DEFAULTS, ...(input.options ?? {}) };
  const { durationMin, bufferMin } = input.service;

  if (durationMin <= 0) return [];
  if (input.workingWindows.length === 0) return [];

  const windows = input.workingWindows.map((w) =>
    localMinutesToInterval(input.date, input.timezone, w.startMinute, w.endMinute)
  );

  const blockers = input.busy
    .map((b) =>
      Interval.fromDateTimes(
        DateTime.fromJSDate(b.start).setZone(input.timezone),
        DateTime.fromJSDate(b.end).setZone(input.timezone)
      )
    )
    .filter((i) => i.isValid && i.length("minutes") > 0);

  const free = subtractAll(windows, blockers);

  const earliest = DateTime.fromJSDate(input.now)
    .setZone(input.timezone)
    .plus({ minutes: opts.minLeadMinutes });

  const slots: Slot[] = [];

  for (const window of free) {
    let cursor = ceilToGrid(window.start!, opts.gridMinutes);

    while (true) {
      const serviceEnd = cursor.plus({ minutes: durationMin });
      const withBuffer = cursor.plus({ minutes: durationMin + bufferMin });

      if (serviceEnd > window.end!) break;

      const bufferClear = blockers.every((b) => {
        const candidate = Interval.fromDateTimes(cursor, withBuffer);
        return !candidate.overlaps(b);
      });

      if (bufferClear && cursor >= earliest) {
        slots.push({
          startsAt: cursor.toUTC().toJSDate(),
          endsAt: serviceEnd.toUTC().toJSDate(),
          localLabel: cursor.toFormat("h:mm a"),
        });
      }

      cursor = cursor.plus({ minutes: opts.gridMinutes });
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function ceilToGrid(dt: DateTime, gridMinutes: number): DateTime {
  const minutes = dt.hour * 60 + dt.minute;
  const rounded = Math.ceil(minutes / gridMinutes) * gridMinutes;
  return dt.startOf("day").plus({ minutes: rounded });
}

export function expandBusyFromAppointments(
  appointments: { startsAt: Date; endsAt: Date }[],
  bufferMin: number
): BusyInterval[] {
  return appointments.map((a) => ({
    start: a.startsAt,
    end: new Date(a.endsAt.getTime() + bufferMin * 60_000),
  }));
}