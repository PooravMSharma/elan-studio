import { DateTime } from "luxon";

export function formatMoney(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatDayLabel(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toFormat("cccc d LLLL");
}

export function formatTime(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date).setZone(timezone).toFormat("h:mm a");
}

export function formatFullWhen(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date)
    .setZone(timezone)
    .toFormat("cccc d LLLL, h:mm a");
}

export function upcomingDates(timezone: string, days = 21): string[] {
  const today = DateTime.now().setZone(timezone).startOf("day");
  return Array.from({ length: days }, (_, i) =>
    today.plus({ days: i }).toISODate()!
  );
}

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export function isValidIndianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return /^[6-9]/.test(digits);
  if (digits.length === 12) return digits.startsWith("91") && /^[6-9]/.test(digits.slice(2));
  return false;
}