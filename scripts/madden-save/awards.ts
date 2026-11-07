/**
 * Weekly and yearly awards. Madden keeps a season's awards in `PlayerAward` without the season
 * on them: a weekly award knows its week, a yearly one its year. Last season's weekly awards
 * stay until this season's week overwrites them, so the first weeks of a season have two rows
 * per award, told apart by where they sit in the table.
 */
import type { AwardType } from "../../shared/domain/awards";
import type { Conference } from "../../shared/domain/teams";
import { seasonWeekKey } from "./calendar";
import type { MaddenPlayer } from "./players";
import { num, str, type Located, type SaveFile } from "./saveFile";
import type { Teams } from "./teams";
import type { AwardRow } from "./types";

const WEEKLY = /^(AFC|NFC)_(Offensive|Defensive)_Player_of_Week$/;

const YEARLY: Record<string, AwardType> = {
  MVP: "MVP",
  Offensive_Player_of_Year: "OPOY",
  Defensive_Player_of_Year: "DPOY",
  Offensive_Rookie_of_Year: "OROY",
  Defensive_Rookie_of_Year: "DROY",
  Coach_of_Year: "COY",
  Best_K: "BestK",
  Best_P: "BestP",
  Best_QB: "BestQB",
  Best_RB: "BestRB",
  Best_WR: "BestWR",
  Best_TE: "BestTE",
  Best_OL: "BestOL",
  Best_DL: "BestDL",
  Best_LB: "BestLB",
  Best_DB: "BestDB",
};

/** A yearly award's period is a season index for franchise seasons and a calendar year for real ones. */
const REAL_YEAR = 1000;

export type AwardContext = {
  baseYear: number;
  currentYearIndex: number;
  /** The season-wide index of the week about to be played, or null outside the season. */
  currentWeek: number | null;
  /** The season has not started, so every weekly award in the save is last season's. */
  beforeSeason: boolean;
};

type WeeklyCandidate = { index: number; week: number; row: AwardRow };

/** Least-squares fit of table index on week, for telling last season's block from this season's rows. */
function fit(points: { index: number; week: number }[]): ((week: number) => number) | null {
  if (points.length < 2) return null;
  const n = points.length;
  const mw = points.reduce((s, p) => s + p.week, 0) / n;
  const mi = points.reduce((s, p) => s + p.index, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.week - mw) ** 2, 0);
  if (sxx === 0) return null;
  const slope = points.reduce((s, p) => s + (p.week - mw) * (p.index - mi), 0) / sxx;
  return (week) => mi + slope * (week - mw);
}

/** Dates each weekly row: last season where only last season can have it, else by its place in the table. */
function dateWeekly(candidates: WeeklyCandidate[], ctx: AwardContext): AwardRow[] {
  const thisYear = ctx.baseYear + ctx.currentYearIndex;
  const lastYear = thisYear - 1;
  if (ctx.beforeSeason || ctx.currentWeek === null) {
    const year = ctx.beforeSeason ? lastYear : thisYear;
    return candidates.map((c) => ({ ...c.row, year }));
  }
  const current = ctx.currentWeek;
  const byAward = new Map<string, WeeklyCandidate[]>();
  for (const c of candidates) {
    const key = `${c.row.award}|${c.row.conference ?? ""}`;
    byAward.set(key, [...(byAward.get(key) ?? []), c]);
  }
  const out: AwardRow[] = [];
  for (const group of byAward.values()) {
    const settled = group.filter((c) => c.week >= current);
    const predict = fit(settled);
    for (const c of settled) out.push({ ...c.row, year: lastYear });
    const byWeek = new Map<number, WeeklyCandidate[]>();
    for (const c of group.filter((c) => c.week < current))
      byWeek.set(c.week, [...(byWeek.get(c.week) ?? []), c]);
    for (const rows of byWeek.values()) {
      if (rows.length === 1 || !predict) {
        for (const c of rows) out.push({ ...c.row, year: thisYear, seasonGuessed: rows.length > 1 });
        continue;
      }
      const old = rows.reduce((a, b) =>
        Math.abs(a.index - predict(a.week)) <= Math.abs(b.index - predict(b.week)) ? a : b,
      );
      for (const c of rows)
        out.push({ ...c.row, year: c === old ? lastYear : thisYear, seasonGuessed: true });
    }
  }
  return out;
}

async function awardOf(
  save: SaveFile,
  teams: Teams,
  players: Map<number, MaddenPlayer>,
  { index, row }: Located,
) {
  const playerIndex = save.refIndex(row.Player);
  const player = playerIndex === null ? null : (players.get(playerIndex) ?? null);
  if (!player) return null;
  const base = {
    name: player.name,
    teamAbbr: teams.ofRef(save, row.Team)?.abbr ?? null,
    position: player.position,
  };
  const type = str(row, "AwardType");
  const period = num(row, "PeriodIndex");
  const weekly = WEEKLY.exec(type);
  if (weekly && str(row, "Period") === "Game") {
    const week = seasonWeekKey(period);
    if (!week) return null;
    const award: AwardType = weekly[2] === "Offensive" ? "OPOW" : "DPOW";
    const conference = weekly[1] as Conference;
    return { weekly: { index, week: period, row: { ...base, year: 0, week, award, conference } } };
  }
  const yearly = YEARLY[type];
  if (yearly && str(row, "Period") === "Season") {
    // A conference-level award (players of the year, the position awards) names its conference.
    const conference = str((await save.deref(row.Conference))?.row ?? {}, "Name");
    const conferenced: { conference?: Conference } =
      conference === "AFC" || conference === "NFC" ? { conference } : {};
    return { yearly: { ...base, ...conferenced, year: period, award: yearly } };
  }
  return null;
}

export async function awardRows(
  save: SaveFile,
  teams: Teams,
  playerList: MaddenPlayer[],
  ctx: AwardContext,
): Promise<AwardRow[]> {
  const players = new Map(playerList.map((p) => [p.index, p]));
  const weekly: WeeklyCandidate[] = [];
  const yearly: AwardRow[] = [];
  for (const located of await save.rows("PlayerAward")) {
    const award = await awardOf(save, teams, players, located);
    if (award?.weekly) weekly.push(award.weekly);
    if (award?.yearly) {
      const { year } = award.yearly;
      yearly.push({ ...award.yearly, year: year < REAL_YEAR ? ctx.baseYear + year : year });
    }
  }
  const seen = new Set(yearly.map((a) => `${a.year}|${a.award}|${a.name}`));
  for (const { row } of await save.rows("YearSummary")) {
    const year = ctx.baseYear + num(row, "PeriodIndex");
    const named = async (ref: unknown, award: AwardType) => {
      const entry = await save.deref(ref);
      if (!entry) return;
      const name = `${str(entry.row, "firstName")} ${str(entry.row, "lastName")}`.trim();
      if (!name || seen.has(`${year}|${award}|${name}`)) return;
      seen.add(`${year}|${award}|${name}`);
      yearly.push({ year, award, name, teamAbbr: null, position: null });
    };
    await named(row.SB_MVP, "SBMVP");
    for (const ref of await save.refsIn(row.AnnualAwards)) {
      const entry = await save.deref(ref);
      const award = entry ? YEARLY[str(entry.row, "AwardType")] : undefined;
      if (award) await named(ref, award);
    }
  }
  return [...dateWeekly(weekly, ctx), ...yearly].sort(
    (a, b) => a.year - b.year || (a.week ?? "").localeCompare(b.week ?? "") || a.award.localeCompare(b.award),
  );
}
