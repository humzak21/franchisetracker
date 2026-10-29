/** Commits for the screens about people: awards, the draft, roster pages, transactions, injuries, cards. */
import { AWARD_INFO, isWeekKey, type AwardType, type TransactionType } from "../../shared/domain";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ensureCoach } from "../lib/coaches";
import { invalid } from "../lib/errors";
import {
  boolOf,
  numberOf,
  positionOf,
  rowPlayer,
  teamCache,
  textOf,
  type RowCommit,
  type RowCommitResult,
  type StoredRow,
} from "./rowCommit";

/** A season's awards, transactions or draft class per read, with headroom. */
const MAX_ROWS = 400;

const conferenceOf = (row: StoredRow) => {
  const c = textOf(row, "conference");
  return c === "AFC" || c === "NFC" ? c : undefined;
};

const awardOf = (row: StoredRow): AwardType | null => {
  const a = textOf(row, "award");
  return a && a in AWARD_INFO ? (a as AwardType) : null;
};

/** Weekly awards replace that week's winner of the same award and conference. */
export async function commitWeeklyAwards(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const weekKey = commit.weekKey;
  if (!weekKey) throw invalid("Tag weekly awards with a week");
  const team = teamCache(ctx);
  const existing = await ctx.db
    .query("awards")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", commit.season._id).eq("weekKey", weekKey))
    .take(MAX_ROWS);
  for (const row of commit.rows) {
    const type = awardOf(row);
    if (!type) continue;
    const conference = conferenceOf(row);
    for (const old of existing.filter((a) => a.type === type && a.conference === conference)) {
      await ctx.db.delete("awards", old._id);
    }
    const teamId = row.teamAbbr ? (await team(row.teamAbbr))._id : undefined;
    const player = row.name || row.playerId ? await rowPlayer(ctx, commit, row, teamId) : null;
    await ctx.db.insert("awards", {
      franchiseId: commit.franchise._id,
      seasonId: commit.season._id,
      weekKey,
      scope: "conference",
      type,
      conference,
      position: positionOf(row) ?? undefined,
      playerId: player?._id,
      rawName: row.name ?? undefined,
      teamId,
      statLine: textOf(row, "statLine"),
    });
  }
  return {};
}

/** Yearly awards and honors: one row per honoree; reading the same screen again adds nothing. */
export async function commitYearlyAwards(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    const type = awardOf(row);
    if (!type) continue;
    const teamId = row.teamAbbr ? (await team(row.teamAbbr))._id : undefined;
    const coach = AWARD_INFO[type].coach;
    if (coach && !row.name) continue;
    // Coach of the Year names a coach: kept by name and added to the coaches, never made a player.
    const rawName =
      coach && row.name ? await ensureCoach(ctx, commit.franchise._id, row.name, teamId) : row.name;
    const player = !coach && (row.name || row.playerId) ? await rowPlayer(ctx, commit, row, teamId) : null;
    const conference = coach ? undefined : conferenceOf(row);
    const position = coach ? undefined : (positionOf(row) ?? undefined);
    const same = await ctx.db
      .query("awards")
      .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", commit.season._id).eq("type", type))
      .take(MAX_ROWS);
    const duplicate = same.some(
      (a) =>
        a.weekKey === undefined &&
        a.conference === conference &&
        a.position === position &&
        (player ? a.playerId === player._id : a.rawName === rawName),
    );
    if (duplicate) continue;
    await ctx.db.insert("awards", {
      franchiseId: commit.franchise._id,
      seasonId: commit.season._id,
      scope: conference ? "conference" : "league",
      type,
      conference,
      position,
      playerId: player?._id,
      rawName: rawName ?? undefined,
      teamId,
      statLine: textOf(row, "statLine"),
    });
  }
  return {};
}

/** Draft picks upserted by overall pick; every pick becomes a player with the draft slot on them. */
export async function commitDraftResults(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    const overall = numberOf(row, "overall");
    const round = numberOf(row, "round");
    if (!row.teamAbbr || overall === undefined || round === undefined) continue;
    const t = await team(row.teamAbbr);
    const player = await rowPlayer(ctx, commit, row, t._id, {
      fields: {
        ovr: numberOf(row, "ovr"),
        exp: 0,
        acquisition: { type: "draft", year: commit.season.year, detail: `Round ${round}, pick ${overall}` },
      },
    });
    const college = textOf(row, "college");
    const bio: Partial<Doc<"players">> = {};
    if (!player.draft) bio.draft = { year: commit.season.year, round, pick: overall, teamId: t._id };
    if (!player.college && college) bio.college = college;
    if (Object.keys(bio).length > 0) await ctx.db.patch("players", player._id, bio);
    const fields = {
      round,
      overall,
      pickInRound: numberOf(row, "pickInRound"),
      teamId: t._id,
      playerId: player._id,
      rawName: row.name ?? undefined,
      position: positionOf(row) ?? player.position,
      ovrAtDraft: numberOf(row, "ovr"),
      college,
    };
    const existing = await ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", commit.season._id).eq("overall", overall))
      .first();
    if (existing) await ctx.db.patch("draftPicks", existing._id, fields);
    else
      await ctx.db.insert("draftPicks", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        ...fields,
      });
  }
  return {};
}

/** A roster page fills in each player's entry for the season: number, OVR, age, dev trait. */
export async function commitRosterPage(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const abbr = typeof commit.meta.team === "string" ? commit.meta.team : null;
  if (!abbr) throw invalid("Pick whose roster this is");
  const t = await teamCache(ctx)(abbr);
  for (const row of commit.rows) {
    const devTrait = textOf(row, "devTrait") as Doc<"rosterEntries">["devTrait"] | undefined;
    const player = await rowPlayer(ctx, commit, row, t._id, {
      complete: true,
      fields: {
        jersey: numberOf(row, "jersey"),
        ovr: numberOf(row, "ovr"),
        age: numberOf(row, "age"),
        exp: numberOf(row, "exp"),
        devTrait,
      },
    });
    const age = numberOf(row, "age");
    if (age !== undefined && player.birthYear === undefined && !player.ageAnchor) {
      await ctx.db.patch("players", player._id, { ageAnchor: { age, year: commit.season.year } });
    }
  }
  return {};
}

/** Moves that bring a player onto the acting team; the rest send one away. */
const INCOMING: readonly TransactionType[] = [
  "sign",
  "resign",
  "trade",
  "waiver_claim",
  "activate",
  "extension",
  "restructure",
];

export async function commitTransactions(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    const type = textOf(row, "type") as TransactionType | undefined;
    if (!type) continue;
    const week = textOf(row, "week");
    const weekKey = week && isWeekKey(week) ? week : commit.weekKey;
    const teamId = row.teamAbbr ? (await team(row.teamAbbr))._id : commit.franchise.userTeamId;
    const counterpart = textOf(row, "counterpart");
    const counterpartTeamId = counterpart ? (await team(counterpart))._id : undefined;
    const player = await rowPlayer(ctx, commit, row, teamId);
    const direction = INCOMING.includes(type) ? "in" : "out";
    const already = await ctx.db
      .query("transactionPlayers")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .take(MAX_ROWS);
    let duplicate = false;
    for (const link of already.filter((l) => l.seasonId === commit.season._id)) {
      const tx = await ctx.db.get("transactions", link.transactionId);
      if (tx && tx.type === type && tx.weekKey === weekKey) duplicate = true;
    }
    if (duplicate) continue;
    const ref = { playerId: player._id, rawName: row.name ?? undefined };
    const transactionId = await ctx.db.insert("transactions", {
      franchiseId: commit.franchise._id,
      seasonId: commit.season._id,
      weekKey,
      type,
      teamId,
      counterpartTeamId,
      playersIn: direction === "in" ? [ref] : [],
      playersOut: direction === "out" ? [ref] : [],
      picksIn: [],
      picksOut: [],
      notes: textOf(row, "detail"),
    });
    await ctx.db.insert("transactionPlayers", {
      franchiseId: commit.franchise._id,
      seasonId: commit.season._id,
      transactionId,
      playerId: player._id,
      direction,
    });
  }
  return {};
}

/** Injuries upserted per player and week; a player on IR shows it on the roster too. */
export async function commitInjuryReport(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    const injuryType = textOf(row, "injury");
    if (!injuryType) continue;
    const teamId = row.teamAbbr ? (await team(row.teamAbbr))._id : commit.franchise.userTeamId;
    const onIr = boolOf(row, "ir") ?? false;
    const player = await rowPlayer(ctx, commit, row, teamId, {
      fields: onIr ? { status: "ir", statusWeekKey: commit.weekKey } : {},
    });
    const fields = {
      teamId,
      injuryType,
      lengthWeeks: numberOf(row, "weeks"),
      lengthLabel: textOf(row, "length"),
      onIr,
    };
    const existing = (
      await ctx.db
        .query("injuries")
        .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
        .take(MAX_ROWS)
    ).find((i) => i.seasonId === commit.season._id && i.weekKey === commit.weekKey);
    if (existing) await ctx.db.patch("injuries", existing._id, fields);
    else {
      await ctx.db.insert("injuries", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        weekKey: commit.weekKey,
        playerId: player._id,
        ...fields,
      });
    }
  }
  return {};
}

/** A player card fills in the season's roster entry and any bio the player is missing. */
export async function commitPlayerCard(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const row = commit.rows[0];
  if (!row) throw invalid("Nothing to commit");
  const teamId = row.teamAbbr ? (await teamCache(ctx)(row.teamAbbr))._id : commit.franchise.userTeamId;
  const years = numberOf(row, "contractYears");
  const apy = numberOf(row, "contractApy");
  const abilities = textOf(row, "abilities")
    ?.split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const player = await rowPlayer(ctx, commit, row, teamId, {
    complete: true,
    fields: {
      jersey: numberOf(row, "jersey"),
      ovr: numberOf(row, "ovr"),
      age: numberOf(row, "age"),
      devTrait: textOf(row, "devTrait") as Doc<"rosterEntries">["devTrait"] | undefined,
      abilities,
      contract:
        years !== undefined || apy !== undefined
          ? {
              years,
              apy,
              total: years !== undefined && apy !== undefined ? years * apy : undefined,
              expiresYear: numberOf(row, "contractExpires"),
            }
          : undefined,
    },
  });
  const bio: Partial<Doc<"players">> = {};
  const college = textOf(row, "college");
  if (college && !player.college) bio.college = college;
  const heightIn = numberOf(row, "heightIn");
  if (heightIn && !player.heightIn) bio.heightIn = heightIn;
  const weightLb = numberOf(row, "weightLb");
  if (weightLb && !player.weightLb) bio.weightLb = weightLb;
  const age = numberOf(row, "age");
  if (age !== undefined && player.birthYear === undefined && !player.ageAnchor) {
    bio.ageAnchor = { age, year: commit.season.year };
  }
  if (Object.keys(bio).length > 0) await ctx.db.patch("players", player._id, bio);
  return { playerId: player._id };
}
