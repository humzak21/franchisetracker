import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// A full backup of every franchise each night (Settings → Data lists and restores them).
crons.cron("nightly backup", "17 8 * * *", internal.ops.backupRun.startNightly, {});

// Screenshots past the retention setting, and anything the extraction budget was holding.
crons.cron("nightly tidy", "47 8 * * *", internal.ops.retention.nightly, {});

// Failed scheduled jobs, filed where Settings → Errors can show them.
crons.interval("scheduled job errors", { minutes: 15 }, internal.ops.errors.sweepScheduled, {});

export default crons;
