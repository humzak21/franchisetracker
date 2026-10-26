/** Coaching staff and schemes per season (FEATURES.md 4.1). Free text, with Madden's schemes as suggestions. */

export const OFFENSIVE_SCHEMES = [
  "West Coast",
  "Spread",
  "Air Raid",
  "Vertical",
  "Run and Shoot",
  "Power Run",
  "Zone Run",
  "Multiple",
] as const;

export const DEFENSIVE_SCHEMES = [
  "4-3",
  "3-4",
  "4-3 Cover 2",
  "4-3 Cover 3",
  "3-4 Odd",
  "3-4 Under",
  "Nickel",
  "Multiple",
] as const;

export type CoachingStaff = {
  headCoach?: string;
  offensiveCoordinator?: string;
  defensiveCoordinator?: string;
  offensiveScheme?: string;
  defensiveScheme?: string;
};

export const STAFF_FIELDS = [
  { key: "headCoach", label: "Head coach", short: "HC" },
  { key: "offensiveCoordinator", label: "Offensive coordinator", short: "OC" },
  { key: "defensiveCoordinator", label: "Defensive coordinator", short: "DC" },
  { key: "offensiveScheme", label: "Offensive scheme", short: "Off" },
  { key: "defensiveScheme", label: "Defensive scheme", short: "Def" },
] as const satisfies readonly { key: keyof CoachingStaff; label: string; short: string }[];

/** "Spread / 3-4", "Spread", or "" when neither scheme is set. */
export function formatSchemes(staff: CoachingStaff | undefined): string {
  return [staff?.offensiveScheme, staff?.defensiveScheme].filter(Boolean).join(" / ");
}

/** Trims every field and drops the empty ones, so a cleared field is removed rather than stored blank. */
export function cleanStaff(staff: CoachingStaff): CoachingStaff | undefined {
  const out: CoachingStaff = {};
  for (const { key } of STAFF_FIELDS) {
    const value = staff[key]?.trim();
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
