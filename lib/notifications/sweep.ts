import { prisma } from "../prisma";
import { getSender } from "./sender";
import {
  TEMPLATE_FOR_JOB,
  buildVariables,
  firstName,
  type TemplateName,
} from "./templates";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

export interface SweepReport {
  picked: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function sweepDueJobs(now = new Date()): Promise<SweepReport> {
  const sender = getSender();

  const jobs = await prisma.notificationJob.findMany({
    where: {
      status: "PENDING",
      sendAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: {
      tenant: {
        select: { id: true, timezone: true, whatsapp: true, name: true },
      },
      appointment: {
        include: {
          customer: true,
          service: { select: { name: true } },
          staff: { select: { name: true } },
        },
      },
      draft: {
        include: { service: { select: { name: true } } },
      },
    },
    orderBy: { sendAt: "asc" },
    take: BATCH_SIZE,
  });

  const report: SweepReport = {
    picked: jobs.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of jobs) {
    const template = TEMPLATE_FOR_JOB[job.type] as TemplateName | undefined;
    if (!template) {
      await cancel(job.id, "unknown job type");
      report.skipped++;
      continue;
    }

    let to: string | null = null;
    let variables: string[] = [];

    if (job.type === "ABANDONED_RECOVERY") {
      const draft = job.draft;
      if (!draft || draft.converted || !draft.phone || !draft.name) {
        await cancel(job.id, "draft completed or incomplete");
        report.skipped++;
        continue;
      }
      to = draft.phone;
      variables = buildVariables(template, {
        customerFirstName: firstName(draft.name),
        serviceName: draft.service?.name ?? "appointment",
      });
    } else {
      const appointment = job.appointment;
      if (!appointment) {
        await cancel(job.id, "appointment missing");
        report.skipped++;
        continue;
      }
      if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
        await cancel(job.id, "appointment cancelled");
        report.skipped++;
        continue;
      }

      // Owner alerts go to the studio, everything else to the customer.
      to =
        job.type === "OWNER_ALERT"
          ? job.tenant.whatsapp
          : appointment.customer.phone;

      if (job.type !== "OWNER_ALERT" && !appointment.customer.whatsappOptIn) {
        await cancel(job.id, "customer opted out");
        report.skipped++;
        continue;
      }

      variables = buildVariables(template, {
        customerName: appointment.customer.name,
        customerFirstName: firstName(appointment.customer.name),
        serviceName: appointment.service.name,
        staffName: appointment.staff.name,
        startsAt: appointment.startsAt,
        timezone: job.tenant.timezone,
      });
    }

    if (!to) {
      await cancel(job.id, "no destination number");
      report.skipped++;
      continue;
    }

    const result = await sender.send({
      to,
      template,
      variables,
      tenantId: job.tenantId,
    });

    if (result.ok) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      report.sent++;
    } else {
      const attempts = job.attempts + 1;
      const exhausted = !result.retryable || attempts >= MAX_ATTEMPTS;
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          attempts,
          lastError: result.error,
          ...(exhausted
            ? {}
            : { sendAt: new Date(Date.now() + backoffMs(attempts)) }),
        },
      });
      report.failed++;
    }
  }

  return report;
}

function backoffMs(attempt: number): number {
  return Math.min(60, 5 * 2 ** attempt) * 60_000;
}

async function cancel(id: string, reason: string) {
  await prisma.notificationJob.update({
    where: { id },
    data: { status: "CANCELLED", lastError: reason },
  });
}