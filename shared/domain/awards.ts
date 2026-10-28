/** Award types (weekly, yearly, honors) and their scopes. */

export const AWARD_TYPES = [
  "OPOW",
  "DPOW",
  "STPOW",
  "ROW",
  "MVP",
  "OPOY",
  "DPOY",
  "OROY",
  "DROY",
  "CPOY",
  "COY",
  "SBMVP",
  "ProBowl",
  "AllPro1",
  "AllPro2",
  "BestK",
  "BestP",
  "BestKR",
  "BestQB",
  "BestRB",
  "BestWR",
  "BestTE",
  "BestOL",
  "BestDL",
  "BestLB",
  "BestDB",
  "FPOY",
  "SackLeader",
  "BallHawk",
  "HeatSeeker",
  "MostOPOW",
  "MostDPOW",
  "custom",
] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

export const AWARD_SCOPES = ["league", "conference", "team"] as const;
export type AwardScope = (typeof AWARD_SCOPES)[number];

/**
 * `yearly` awards and `honor` rosters come from Madden's awards screens; `counted` awards are
 * the league leaders in a stat or in weekly awards (`shared/awards/counted.ts`).
 */
type AwardInfo = { label: string; cadence: "weekly" | "yearly" | "honor" | "counted" | "custom" };

export const AWARD_INFO: Record<AwardType, AwardInfo> = {
  OPOW: { label: "Offensive Player of the Week", cadence: "weekly" },
  DPOW: { label: "Defensive Player of the Week", cadence: "weekly" },
  STPOW: { label: "Special Teams Player of the Week", cadence: "weekly" },
  ROW: { label: "Rookie of the Week", cadence: "weekly" },
  MVP: { label: "Most Valuable Player", cadence: "yearly" },
  OPOY: { label: "Offensive Player of the Year", cadence: "yearly" },
  DPOY: { label: "Defensive Player of the Year", cadence: "yearly" },
  OROY: { label: "Offensive Rookie of the Year", cadence: "yearly" },
  DROY: { label: "Defensive Rookie of the Year", cadence: "yearly" },
  CPOY: { label: "Comeback Player of the Year", cadence: "yearly" },
  COY: { label: "Coach of the Year", cadence: "yearly" },
  SBMVP: { label: "Super Bowl MVP", cadence: "yearly" },
  ProBowl: { label: "Pro Bowl", cadence: "honor" },
  AllPro1: { label: "First-Team All-Pro", cadence: "honor" },
  AllPro2: { label: "Second-Team All-Pro", cadence: "honor" },
  BestK: { label: "Best Kicker", cadence: "yearly" },
  BestP: { label: "Best Punter", cadence: "yearly" },
  BestKR: { label: "Best Kick Returner", cadence: "yearly" },
  BestQB: { label: "Best Quarterback", cadence: "yearly" },
  BestRB: { label: "Best Running Back", cadence: "yearly" },
  BestWR: { label: "Best Wide Receiver", cadence: "yearly" },
  BestTE: { label: "Best Tight End", cadence: "yearly" },
  BestOL: { label: "Best Offensive Lineman", cadence: "yearly" },
  BestDL: { label: "Best Defensive Lineman", cadence: "yearly" },
  BestLB: { label: "Best Linebacker", cadence: "yearly" },
  BestDB: { label: "Best Defensive Back", cadence: "yearly" },
  FPOY: { label: "Fantasy Player of the Year", cadence: "counted" },
  SackLeader: { label: "Sack Leader", cadence: "counted" },
  BallHawk: { label: "Ball Hawk", cadence: "counted" },
  HeatSeeker: { label: "Heat Seeker", cadence: "counted" },
  MostOPOW: { label: "Most Offensive POTW", cadence: "counted" },
  MostDPOW: { label: "Most Defensive POTW", cadence: "counted" },
  custom: { label: "Custom award", cadence: "custom" },
};
