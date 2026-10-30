/** Who the printed names in a read draft are: the last step before it is stored for review. */
import { matchDraftRow } from "../../shared/ingestion/draftMatch";
import { matchPlayer, nameTokens } from "../../shared/ingestion/nameMatch";
import type { DraftRow } from "../../shared/ingestion/rows/types";
import { isRowDraft, rowTarget } from "../../shared/ingestion/targets";
import type { Draft, FieldConfidence, RowTargetDraft } from "../../shared/ingestion/types";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";

/** What resolving needs of the extraction job. */
type ResolveJob = {
  seasonId: Id<"seasons"> | null;
  gameTeams: string[];
  teams: { home: string; away: string; userIsHome: boolean };
};

/** Low confidence on a name the rosters could not settle, so review shows it first. */
const UNSETTLED_NAME = 0.4;

/**
 * The printed names in a draft and the teams to look them up in. A game starts from who was
 * scheduled, so a team the model misread cannot lose the real opponent's roster.
 */
function namesOf(
  draft: Draft,
  job: ResolveJob,
  userTeamAbbr: string,
): { names: string[]; teams: string[] } | null {
  if ("lines" in draft) {
    const plays = "plays" in draft ? (draft.plays ?? []) : [];
    return {
      names: [...draft.lines.map((l) => l.name), ...plays.flatMap((p) => (p.name ? [p.name] : []))],
      teams: [
        ...job.gameTeams,
        draft.game.homeAbbr,
        draft.game.awayAbbr,
        ...draft.lines.map((l) => l.teamAbbr),
      ].filter((t): t is string => t !== null),
    };
  }
  const spec = isRowDraft(draft) ? rowTarget(draft.target).spec : null;
  if (!isRowDraft(draft) || !spec?.player) return null;
  const metaTeam = typeof draft.meta.team === "string" ? draft.meta.team : null;
  return {
    names: draft.rows.flatMap((r) => (r.name ? [r.name] : [])),
    teams: [metaTeam ?? userTeamAbbr, ...draft.rows.map((r) => r.teamAbbr)].filter(
      (t): t is string => t !== null,
    ),
  };
}

/** Last season's choice for a name: as good as a clean match, short of this season's own choice. */
const CARRIED_SCORE = 0.95;

/** Lookups per call: a draft board of 200+ picks is resolved in a few queries. */
const NAMES_PER_LOOKUP = 100;

/**
 * A draft class matches only this season's picks and created players: a roster namesake is a false
 * match, since most of the class is new. A pick left unsettled waits for review, like any row.
 */
async function resolveDraftClass(
  ctx: ActionCtx,
  job: ResolveJob,
  draft: RowTargetDraft,
  confidence: FieldConfidence[],
): Promise<StoredDraft> {
  const { picks, pool } = await ctx.runQuery(internal.ingestion.candidates.draftClass, {
    seasonId: job.seasonId,
  });
  const rows = draft.rows.map((row) => {
    const match = matchDraftRow<Id<"players">>(row, pool, picks);
    if (match.status === "new") return row;
    const entry = confidence.find((c) => c.path === `rows.${row.id}.name`);
    if (entry) entry.value = match.status === "matched" ? 1 : Math.min(entry.value, UNSETTLED_NAME);
    return match.status === "matched"
      ? { ...row, match, playerId: match.candidates[0]?.playerId ?? null }
      : { ...row, match, accepted: false };
  });
  return { ...draft, rows } as StoredDraft;
}

export async function resolvePlayers(
  ctx: ActionCtx,
  job: ResolveJob,
  draft: Draft,
  confidence: FieldConfidence[],
): Promise<StoredDraft> {
  if (isRowDraft(draft) && rowTarget(draft.target).spec.newPlayers)
    return await resolveDraftClass(ctx, job, draft, confidence);
  const wanted = namesOf(draft, job, job.teams.userIsHome ? job.teams.home : job.teams.away);
  if (!wanted) return draft as StoredDraft;
  const userTeamAbbr = job.teams.userIsHome ? job.teams.home : job.teams.away;
  const metaTeam = isRowDraft(draft) && typeof draft.meta.team === "string" ? draft.meta.team : null;
  const named = (rows: readonly DraftRow[]) =>
    rows.flatMap((r) => (r.name ? [{ name: r.name, teamAbbr: r.teamAbbr ?? metaTeam ?? userTeamAbbr }] : []));
  const plays = "plays" in draft ? (draft.plays ?? []) : [];
  const printed =
    "lines" in draft ? [...draft.lines, ...named(plays)] : isRowDraft(draft) ? named(draft.rows) : [];
  const remembered = new Map<
    string,
    { playerId: Id<"players">; name: string; score: number; carried: boolean }
  >();
  for (let i = 0; i < printed.length; i += NAMES_PER_LOOKUP) {
    const found = await ctx.runQuery(internal.ingestion.candidates.assignments, {
      seasonId: job.seasonId,
      names: printed.slice(i, i + NAMES_PER_LOOKUP).map((r) => ({ name: r.name, teamAbbr: r.teamAbbr })),
    });
    for (const r of found)
      remembered.set(`${r.teamAbbr}|${r.normalizedName}`, {
        playerId: r.playerId,
        name: r.name,
        score: r.carried ? CARRIED_SCORE : 1,
        carried: r.carried,
      });
  }
  const teamAbbrs = [...new Set(wanted.teams)];
  const candidates: Awaited<ReturnType<typeof lookup>> = [];
  const lookup = (names: string[]) =>
    ctx.runQuery(internal.ingestion.candidates.forNames, { seasonId: job.seasonId, teamAbbrs, names });
  for (let i = 0; i < Math.max(1, wanted.names.length); i += NAMES_PER_LOOKUP) {
    const found = await lookup(wanted.names.slice(i, i + NAMES_PER_LOOKUP));
    for (const c of found) if (!candidates.some((k) => k.playerId === c.playerId)) candidates.push(c);
  }
  const resolve = <T extends { name: string; teamAbbr: string | null }>(row: T, path: string) => {
    const saved = remembered.get(`${row.teamAbbr}|${nameTokens(row.name).join(" ")}`);
    if (saved) {
      const entry = confidence.find((c) => c.path === path);
      if (entry && !saved.carried) entry.value = 1;
      const { carried: _, ...candidate } = saved;
      return { match: { status: "matched" as const, candidates: [candidate] }, playerId: saved.playerId };
    }
    const match = matchPlayer<Id<"players">>(row.name, candidates, row);
    if (match.status === "ambiguous") {
      const entry = confidence.find((c) => c.path === path);
      if (entry) entry.value = Math.min(entry.value, UNSETTLED_NAME);
    }
    return { match, playerId: match.status === "matched" ? (match.candidates[0]?.playerId ?? null) : null };
  };
  const resolveRow = (row: DraftRow, optional: boolean | undefined, root: string) => {
    if (!row.name) {
      const match = optional ? { status: "new" as const, candidates: [] } : null;
      return { ...row, playerId: null, match };
    }
    const resolved = resolve(
      { name: row.name, teamAbbr: row.teamAbbr ?? metaTeam ?? userTeamAbbr },
      `${root}.${row.id}.name`,
    );
    // A name the rosters could not settle waits for a decision before it commits, unless the
    // row can stand without a player, when it would only hold the rest of the list back.
    const settled = optional || resolved.match.status !== "ambiguous";
    return { ...row, ...resolved, accepted: row.accepted && settled };
  };
  if ("lines" in draft) {
    const lines = draft.lines.map((line) => ({ ...line, ...resolve(line, `lines.${line.id}.name`) }));
    return draft.target === "game_log"
      ? { ...draft, lines, plays: plays.map((p) => resolveRow(p, true, "plays")) }
      : { ...draft, lines };
  }
  if (!isRowDraft(draft)) return draft as StoredDraft;
  const { optionalPlayer } = rowTarget(draft.target).spec;
  return { ...draft, rows: draft.rows.map((row) => resolveRow(row, optionalPlayer, "rows")) };
}
