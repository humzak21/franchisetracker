/** What every row target's commit gets, and small readers for row values. */
import { isPosition, type WeekKey } from "../../shared/domain";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";
import { teamByAbbr } from "./commitGame";
import { ensureRosterEntry, playerFor } from "./rowPlayers";

export type StoredRowsDraft = Exclude<StoredDraft, { target: "game_box_score" | "team_game_stats" }>;
export type StoredRow = StoredRowsDraft["rows"][number];

export type RowCommit = {
  franchise: Doc<"franchises">;
  season: Doc<"seasons">;
  /** The week the set was tagged with, for weekly screens. */
  weekKey: WeekKey | undefined;
  meta: StoredRowsDraft["meta"];
  /** Accepted rows only. */
  rows: StoredRow[];
};

/** Where the review goes after commit: a player page for a card, else the next set. */
export type RowCommitResult = { playerId?: Id<"players"> };

export const numberOf = (row: StoredRow, key: string): number | undefined =>
  typeof row.values[key] === "number" ? (row.values[key] as number) : undefined;
export const textOf = (row: StoredRow, key: string): string | undefined =>
  typeof row.values[key] === "string" && row.values[key] !== "" ? (row.values[key] as string) : undefined;
export const boolOf = (row: StoredRow, key: string): boolean | undefined =>
  typeof row.values[key] === "boolean" ? (row.values[key] as boolean) : undefined;
export const positionOf = (row: StoredRow): Doc<"players">["position"] | null => {
  const p = textOf(row, "position");
  return p && isPosition(p) ? p : null;
};

/** Teams by abbreviation, read once per commit. */
export function teamCache(ctx: MutationCtx) {
  const cache = new Map<string, Promise<Doc<"teams">>>();
  return (abbr: string) => {
    if (!cache.has(abbr)) cache.set(abbr, teamByAbbr(ctx, abbr));
    return cache.get(abbr)!;
  };
}

/** The row's player (chosen in review or created) and their roster entry for the row's team. */
export async function rowPlayer(
  ctx: MutationCtx,
  commit: RowCommit,
  row: StoredRow,
  teamId: Id<"teams">,
  options: { fields?: Parameters<typeof ensureRosterEntry>[1]["fields"]; complete?: boolean } = {},
): Promise<Doc<"players">> {
  const player = await playerFor(ctx, commit.franchise._id, {
    name: row.name ?? "Unknown player",
    playerId: row.playerId,
    position: positionOf(row),
  });
  await ensureRosterEntry(ctx, {
    player,
    seasonId: commit.season._id,
    teamId,
    userTeamId: commit.franchise.userTeamId,
    position: positionOf(row) ?? player.position,
    ...options,
  });
  return player;
}
