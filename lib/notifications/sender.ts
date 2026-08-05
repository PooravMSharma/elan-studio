import { prisma } from "../prisma";
import type { TemplateName } from "./templates";
import { LANGUAGE } from "./templates";

export interface SendRequest {
  to: string;
  template: TemplateName;
  variables: string[];
  tenantId: string;
}

export type SendResult =
  | { ok: true; providerId?: string }
  | { ok: false; error: string; retryable: boolean };

export interface NotificationSender {
  send(request: SendRequest): Promise<SendResult>;
}

/**
 * Talks to the existing WhatsApp platform over HTTP rather than calling Meta
 * directly. Keeps token refresh, template sync and the 24-hour window in the
 * service that already handles them.
 *
 * Adjust the body shape below to match your platform's send endpoint.
 */
export class HttpSender implements NotificationSender {
  constructor(
    private baseUrl: string,
    private token: string
  ) {}

  async send(request: SendRequest): Promise<SendResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/send/template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          to: request.to,
          name: request.template,
          language: LANGUAGE,
          variables: { body: request.variables },
        }),
      });

      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          id?: string;
          message_id?: string;
        };
        return { ok: true, providerId: data.id ?? data.message_id };
      }

      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: `${response.status} ${text}`.slice(0, 400),
        // 4xx is our fault and will fail again; 5xx and 429 are worth retrying.
        retryable: response.status >= 500 || response.status === 429,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "network error",
        retryable: true,
      };
    }
  }
}

/**
 * Writes what would have been sent instead of sending it. Used for local
 * development, seeded demo data, and anyone running the repo without Meta
 * credentials.
 */
export class ConsoleSender implements NotificationSender {
  async send(request: SendRequest): Promise<SendResult> {
    console.log(
      `[notify] ${request.template} → ${request.to} :: ${request.variables.join(" | ")}`
    );
    return { ok: true, providerId: `simulated-${Date.now()}` };
  }
}

export function getSender(): NotificationSender {
  const mode = process.env.NOTIFY_MODE ?? "simulated";
  if (mode !== "live") return new ConsoleSender();

  const baseUrl = process.env.WA_PLATFORM_URL;
  const token = process.env.WA_PLATFORM_TOKEN;
  if (!baseUrl || !token) {
    console.warn("[notify] NOTIFY_MODE=live but platform URL or token missing");
    return new ConsoleSender();
  }
  return new HttpSender(baseUrl, token);
}

export async function isOptedIn(
  tenantId: string,
  phone: string
): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
    select: { whatsappOptIn: true },
  });
  return customer?.whatsappOptIn ?? false;
}