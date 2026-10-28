/**
 * Rebuilds the records book from the user team's season rows and writes only what changed.
 * A record that changes hands to a bigger number in the committed game's season keeps the old
 * holder as `previous` and is reported back so a "record broken" milestone can be raised. The lists
 * that changed are reported too, for their placements (`stats/recordBuild`).
 */
import { RECORD_SCOPES, RECORD_STATS, rankStat, type RankEntry, type RecordScope } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ListKey } from "./boards";
import { userSeasonRows, type Split } from "./load";

/** Two splits, three scopes and every recordable stat, with headroom. */
const MAX_RECORDS = 1000;

export type BrokenRecord = {
  recordId: Id<"records">;
  statKey: string;
  scope: RecordScope;
  split: Split;
  playerId: Id<"players">;
  value: number;
};

type Entry = RankEntry<Id<"players">, Id<"seasons">>;

/** The game a single-game record was set in: the holder's line that season with that value. */
async function gameOf(ctx: MutationCtx, holder: Entry, stat: string) {
  const lines = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) =>
      q.eq("playerId", holder.playerId).eq("seasonId", holder.seasonId),
    )
    .take(40);
  return lines.find((l) => l.stats[stat] === holder.value);
}

const sameTop = (a: readonly Entry[], b: readonly Entry[]) => JSON.stringify(a) === JSON.stringify(b);

export async function refreshRecords(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
): Promise<{ broken: BrokenRecord[]; changed: ListKey[] }> {
  const rows = await userSeasonRows(ctx, franchise);
  const existing = await ctx.db
    .query("records")
    .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) => q.eq("franchiseId", franchise._id))
    .take(MAX_RECORDS);
  const byKey = new Map(existing.map((r) => [`${r.split}|${r.scope}|${r.statKey}`, r]));
  const broken: BrokenRecord[] = [];
  const changed: ListKey[] = [];

  for (const split of ["regular", "postseason"] as const) {
    for (const scope of RECORD_SCOPES) {
      for (const stat of RECORD_STATS) {
        const top = rankStat(rows[split], stat, scope);
        const current = byKey.get(`${split}|${scope}|${stat}`);
        const holder = top[0];
        if (!holder) {
          if (current) {
            await ctx.db.delete("records", current._id);
            changed.push({ split, scope, statKey: stat });
          }
          continue;
        }
        if (current && sameTop(current.top, top)) continue;
        changed.push({ split, scope, statKey: stat });

        const samePlayerSeason =
          !!current && current.playerId === holder.playerId && current.seasonId === holder.seasonId;
        const line =
          scope === "game" && (!samePlayerSeason || current?.value !== holder.value)
            ? await gameOf(ctx, holder, stat)
            : undefined;
        // A single-game record changes hands when the game does, even to the same player.
        const changedHands = !samePlayerSeason || (line !== undefined && line.gameId !== current?.gameId);
        const fields = {
          playerId: holder.playerId,
          value: holder.value,
          seasonId: holder.seasonId,
          year: holder.year,
          weekKey: scope === "game" ? (line?.weekKey ?? current?.weekKey) : undefined,
          gameId: scope === "game" ? (line?.gameId ?? current?.gameId) : undefined,
          top,
        };
        if (!current) {
          await ctx.db.insert("records", {
            franchiseId: franchise._id,
            statKey: stat,
            scope,
            split,
            setAt: Date.now(),
            ...fields,
          });
          continue;
        }
        // Only a bigger number breaks a record; a correction that lowers it just rewrites the holder.
        const isBreak = changedHands && current.playerId !== undefined && holder.value > current.value;
        await ctx.db.patch("records", current._id, {
          ...fields,
          ...(isBreak
            ? {
                setAt: Date.now(),
                previous: {
                  playerId: current.playerId,
                  rawName: current.rawName,
                  value: current.value,
                  year: current.year,
                },
              }
            : {}),
        });
        if (isBreak && holder.seasonId === game.seasonId) {
          broken.push({
            recordId: current._id,
            statKey: stat,
            scope,
            split,
            playerId: holder.playerId,
            value: holder.value,
          });
        }
      }
    }
  }
  return { broken, changed };
}
