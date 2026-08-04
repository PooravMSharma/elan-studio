import { computeSlots, expandBusyFromAppointments } from "../lib/availability/core";
import { DateTime } from "luxon";

const TZ = "Asia/Kolkata";
const DATE = "2026-09-15";

const NOW = DateTime.fromISO("2026-09-14T10:00:00", { zone: TZ }).toJSDate();

const FULL_DAY = [{ startMinute: 10 * 60, endMinute: 19 * 60 }];

const HAIRCUT = { durationMin: 45, bufferMin: 15 };
const BRIDAL = { durationMin: 180, bufferMin: 30 };

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

function at(time: string): Date {
  return DateTime.fromISO(`${DATE}T${time}`, { zone: TZ }).toJSDate();
}

function labels(slots: { localLabel: string }[]) {
  return slots.map((s) => s.localLabel);
}

console.log("\n1. Open day, 45-minute haircut");
const open = computeSlots({
  date: DATE,
  timezone: TZ,
  service: HAIRCUT,
  workingWindows: FULL_DAY,
  busy: [],
  now: NOW,
});
console.log(`  ${open.length} slots, ${open[0].localLabel} to ${open[open.length - 1].localLabel}`);
check("first slot is at opening time", open[0].localLabel === "10:00 AM");
check(
  "last slot leaves room to finish before close",
  open[open.length - 1].localLabel === "6:15 PM",
  open[open.length - 1].localLabel
);

console.log("\n2. One booking removes its own slot and the buffer around it");
const booked = computeSlots({
  date: DATE,
  timezone: TZ,
  service: HAIRCUT,
  workingWindows: FULL_DAY,
  busy: expandBusyFromAppointments(
    [{ startsAt: at("13:00"), endsAt: at("13:45") }],
    HAIRCUT.bufferMin
  ),
  now: NOW,
});
const bookedLabels = labels(booked);
check("13:00 itself is gone", !bookedLabels.includes("1:00 PM"));
check("12:30 is gone (would overrun into the booking)", !bookedLabels.includes("12:30 PM"));
check("12:00 survives (finishes 12:45, buffer clears 1:00)", bookedLabels.includes("12:00 PM"));
check("14:00 survives (after the 15-min cleanup buffer)", bookedLabels.includes("2:00 PM"));
check("fewer slots than the open day", booked.length < open.length);

console.log("\n3. Salon closed all day");
const closed = computeSlots({
  date: DATE,
  timezone: TZ,
  service: HAIRCUT,
  workingWindows: FULL_DAY,
  busy: [{ start: at("00:00"), end: at("23:59") }],
  now: NOW,
});
check("no slots offered", closed.length === 0, `got ${closed.length}`);

console.log("\n4. Long service on the same schedule");
const bridal = computeSlots({
  date: DATE,
  timezone: TZ,
  service: BRIDAL,
  workingWindows: FULL_DAY,
  busy: [],
  now: NOW,
});
check("far fewer slots than a haircut", bridal.length < open.length);
check(
  "last bridal slot finishes by close",
  bridal[bridal.length - 1].localLabel === "4:00 PM",
  bridal[bridal.length - 1].localLabel
);

console.log("\n5. Bridal cannot squeeze into a gap that only fits a haircut");
const gap = computeSlots({
  date: DATE,
  timezone: TZ,
  service: BRIDAL,
  workingWindows: FULL_DAY,
  busy: [
    { start: at("10:00"), end: at("12:00") },
    { start: at("14:00"), end: at("19:00") },
  ],
  now: NOW,
});
check("two-hour gap rejected for a three-hour service", gap.length === 0, `got ${gap.length}`);

console.log("\n6. Split shift (lunch break)");
const split = computeSlots({
  date: DATE,
  timezone: TZ,
  service: HAIRCUT,
  workingWindows: [
    { startMinute: 10 * 60, endMinute: 13 * 60 },
    { startMinute: 15 * 60, endMinute: 19 * 60 },
  ],
  busy: [],
  now: NOW,
});
const splitLabels = labels(split);
check("nothing offered during the break", !splitLabels.some((l) => l === "1:30 PM" || l === "2:00 PM"));
check("morning shift present", splitLabels.includes("10:00 AM"));
check("afternoon shift present", splitLabels.includes("3:00 PM"));

console.log("\n7. Minimum lead time on same-day bookings");
const sameDayNow = DateTime.fromISO(`${DATE}T12:00:00`, { zone: TZ }).toJSDate();
const sameDay = computeSlots({
  date: DATE,
  timezone: TZ,
  service: HAIRCUT,
  workingWindows: FULL_DAY,
  busy: [],
  now: sameDayNow,
  options: { minLeadMinutes: 60 },
});
check("nothing in the past", !labels(sameDay).includes("11:00 AM"));
check("nothing inside the 60-minute lead window", !labels(sameDay).includes("12:30 PM"));
check("13:00 is the first bookable slot", sameDay[0].localLabel === "1:00 PM", sameDay[0]?.localLabel);

console.log("\n8. Slots are stored in UTC, displayed in salon time");
check(
  "10:00 AM IST is 04:30 UTC",
  open[0].startsAt.toISOString() === "2026-09-15T04:30:00.000Z",
  open[0].startsAt.toISOString()
);

console.log(
  failures === 0
    ? `\nAll checks passed.\n`
    : `\n${failures} check(s) failed.\n`
);

process.exit(failures === 0 ? 0 : 1);