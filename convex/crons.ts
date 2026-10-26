import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// A full backup of every franchise each night (Settings → Data lists and restores them).
crons.cron("nightly backup", "17 8 * * *", internal.ops.backupRun.nightly, {});

export default crons;
