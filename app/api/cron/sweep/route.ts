import { NextRequest } from "next/server";
import { sweepDueJobs } from "@/lib/notifications/sweep";
import { queueAbandonedRecoveries } from "@/lib/notifications/abandoned";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.nextUrl.searchParams.get("key");

  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const queued = await queueAbandonedRecoveries(now);
  const report = await sweepDueJobs(now);

  return Response.json({
    ranAt: now.toISOString(),
    abandonedQueued: queued,
    ...report,
  });
}