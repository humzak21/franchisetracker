/** Settings → Maintenance (FEATURES.md 5.12): every job the owner might need, none from a terminal. */

export const MAINTENANCE_JOBS = [
  "rebuildStats",
  "teamTotals",
  "starLines",
  "seasonStatsTeams",
  "screenshots",
] as const;
export type MaintenanceJob = (typeof MAINTENANCE_JOBS)[number];

export const MAINTENANCE_INFO: Record<
  MaintenanceJob,
  { label: string; detail: string; /** Shows what it would do before it does it. */ previews: boolean }
> = {
  rebuildStats: {
    label: "Rebuild stats",
    detail: "Works out every season, record, mark and streak again from the game logs.",
    previews: false,
  },
  teamTotals: {
    label: "Recount team totals",
    detail: "Works out each season's team stats again from its games.",
    previews: false,
  },
  starLines: {
    label: "Clear typed star lines",
    detail: "Removes a star's caption when it only repeats the stat line from the box score.",
    previews: true,
  },
  seasonStatsTeams: {
    label: "Move misfiled season stats",
    detail: "Moves season stats filed under your team back to the team the player really plays for.",
    previews: true,
  },
  screenshots: {
    label: "Clear old screenshots",
    detail: "Deletes what the retention setting says has aged out, as the nightly tidy does.",
    previews: true,
  },
};

/** What a check found: how many things it would change, said in words and listed where it can. */
export type JobOutcome = { count: number; summary: string; lines: string[] };

/** "1 caption", "3 captions". */
export const counted = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
