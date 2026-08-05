import "dotenv/config";
import { sweepDueJobs } from "../lib/notifications/sweep";
import { queueAbandonedRecoveries } from "../lib/notifications/abandoned";

async function main() {
  const now = new Date();
  const queued = await queueAbandonedRecoveries(now);
  const report = await sweepDueJobs(now);

  console.log(`\nabandoned queued : ${queued}`);
  console.log(`picked           : ${report.picked}`);
  console.log(`sent             : ${report.sent}`);
  console.log(`failed           : ${report.failed}`);
  console.log(`skipped          : ${report.skipped}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));