import { DateTime } from "luxon";

export type TemplateName =
  | "booking_confirmation"
  | "appointment_reminder"
  | "owner_alert"
  | "review_request"
  | "abandoned_recovery";

export const TEMPLATE_FOR_JOB: Record<string, TemplateName> = {
  BOOKING_CONFIRMATION: "booking_confirmation",
  APPOINTMENT_REMINDER: "appointment_reminder",
  OWNER_ALERT: "owner_alert",
  REVIEW_REQUEST: "review_request",
  ABANDONED_RECOVERY: "abandoned_recovery",
};

export const LANGUAGE = "en";

export interface AppointmentContext {
  customerName: string;
  customerFirstName: string;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  timezone: string;
}

export interface DraftContext {
  customerFirstName: string;
  serviceName: string;
}

/**
 * Variable order differs per template — review_request in particular does not
 * follow the pattern the others use. Keep this the single source of truth.
 */
export function buildVariables(
  template: TemplateName,
  ctx: AppointmentContext | DraftContext
): string[] {
  if (template === "abandoned_recovery") {
    const d = ctx as DraftContext;
    return [d.customerFirstName, d.serviceName];
  }

  const a = ctx as AppointmentContext;
  const start = DateTime.fromJSDate(a.startsAt).setZone(a.timezone);

  switch (template) {
    case "booking_confirmation":
      return [
        a.customerFirstName,
        a.serviceName,
        start.toFormat("cccc d LLLL, h:mm a"),
        a.staffName,
      ];

    case "appointment_reminder":
      // {{3}} is time only — the word "tomorrow" carries the day.
      return [
        a.customerFirstName,
        a.serviceName,
        start.toFormat("h:mm a"),
        a.staffName,
      ];

    case "owner_alert":
      return [
        a.customerName,
        a.serviceName,
        start.toFormat("cccc d LLLL, h:mm a"),
        a.staffName,
      ];

    case "review_request":
      // Three variables, and the service name is {{3}}, not {{2}}.
      return [
        a.customerFirstName,
        start.toFormat("d LLLL"),
        a.serviceName,
      ];
  }
}

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}