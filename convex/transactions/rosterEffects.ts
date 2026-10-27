/**
 * Applies a move's roster plan (`shared/transactions/plan.ts`) and undoes it from the stored
 * change record. Undo restores only what still holds the move's value, so manual edits stay.
 */
import type { Infer } from "convex/values";
import {
  carryOver,
  diffFields,
  undoPatch,
  untouchedSince,
  type CarriedEntry,
  type RosterField,
  type RosterFields,
  type RosterOp,
} from "../../shared/transactions";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { seasonYears } from "../lib/refs";
import type { vMoveEffects } from "../schema/transactions";

export type MoveEffects = Infer<typeof vMoveEffects>;
type RosterEffect = MoveEffects["roster"][number];
type Op = RosterOp<Id<"teams">, Id<"players">>;

/** A player's entries in one season (one per team, rarely more than a few). */
const MAX_SEASON_ENTRIES = 20;
/** A career's entries, to find the latest when the season has none. */
const MAX_CAREER_ENTRIES = 40;

const fieldsOf = (entry: Doc<"rosterEntries">): RosterFields => ({
  status: entry.status,
  statusWeekKey: entry.statusWeekKey,
  acquisition: entry.acquisition,
  contract: entry.contract,
});

/** A patch for the listed fields; a missing value clears the field (status is never cleared). */
function toPatch(fields: RosterFields, keys: readonly RosterField[]) {
  return {
    ...(keys.includes("status") && fields.status ? { status: fields.status } : {}),
    ...(keys.includes("statusWeekKey") ? { statusWeekKey: fields.statusWeekKey } : {}),
    ...(keys.includes("acquisition") ? { acquisition: fields.acquisition } : {}),
    ...(keys.includes("contract") ? { contract: fields.contract } : {}),
  };
}

const defined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

/** The entry a new one copies from: the old team's this season, any this season, else the latest. */
async function sourceEntry(
  ctx: MutationCtx,
  seasonEntries: Doc<"rosterEntries">[],
  playerId: Id<"players">,
  fromTeamId: Id<"teams"> | undefined,
): Promise<{ entry: Doc<"rosterEntries">; sameSeason: boolean } | null> {
  const same = seasonEntries.find((e) => e.teamId === fromTeamId) ?? seasonEntries[0];
  if (same) return { entry: same, sameSeason: true };
  const career = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
    .take(MAX_CAREER_ENTRIES);
  const years = await seasonYears(
    ctx,
    career.map((e) => e.seasonId),
  );
  const latest = career.reduce<Doc<"rosterEntries"> | undefined>(
    (best, e) => (!best || (years.get(e.seasonId) ?? 0) > (years.get(best.seasonId) ?? 0) ? e : best),
    undefined,
  );
  return latest ? { entry: latest, sameSeason: false } : null;
}

export type RosterContext = {
  franchiseId: Id<"franchises">;
  seasonId: Id<"seasons">;
  userTeamId: Id<"teams">;
  /** Rating and age typed for players the move created. */
  extras: Map<Id<"players">, { ovr?: number; age?: number }>;
};

async function applyOp(ctx: MutationCtx, rc: RosterContext, op: Op): Promise<RosterEffect | null> {
  if (op.kind === "retire") return null;
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", op.playerId).eq("seasonId", rc.seasonId))
    .take(MAX_SEASON_ENTRIES);
  const existing = entries.find((e) => e.teamId === op.teamId);
  if (existing) {
    const change = diffFields(fieldsOf(existing), op.set);
    if (change.changed.length === 0) return null;
    await ctx.db.patch("rosterEntries", existing._id, toPatch(change.next, change.changed));
    return { entryId: existing._id, created: false, ...change };
  }
  if (op.kind === "update") return null;
  const player = await ctx.db.get("players", op.playerId);
  if (!player) return null;
  const source = await sourceEntry(ctx, entries, op.playerId, op.fromTeamId);
  const carried: CarriedEntry = source
    ? carryOver(source.entry, source.sameSeason)
    : { position: player.position, ...defined(rc.extras.get(op.playerId) ?? {}) };
  const set: RosterFields = { status: "active", ...op.createWith, ...op.set };
  const change = diffFields({}, set);
  const entryId = await ctx.db.insert("rosterEntries", {
    franchiseId: rc.franchiseId,
    seasonId: rc.seasonId,
    teamId: op.teamId,
    playerId: op.playerId,
    ...carried,
    ...defined(set),
    status: set.status ?? "active",
    // Other teams' rosters are partial unless a roster screen fills them in.
    ...(op.teamId === rc.userTeamId ? {} : { partial: true }),
  });
  return { entryId, created: true, ...change };
}

/** Applies the roster plan; returns what changed and which players it retired. */
export async function applyRoster(
  ctx: MutationCtx,
  rc: RosterContext,
  ops: readonly Op[],
): Promise<Pick<MoveEffects, "roster" | "retired">> {
  const roster: RosterEffect[] = [];
  const retired: Id<"players">[] = [];
  for (const op of ops) {
    if (op.kind === "retire") {
      const player = await ctx.db.get("players", op.playerId);
      if (player && !player.retired) {
        await ctx.db.patch("players", player._id, { retired: true });
        retired.push(player._id);
      }
      continue;
    }
    const effect = await applyOp(ctx, rc, op);
    if (effect) roster.push(effect);
  }
  return { roster, retired };
}

/** Undoes roster changes newest first, then un-retires players still retired. */
export async function undoRoster(ctx: MutationCtx, effects: Pick<MoveEffects, "roster" | "retired">) {
  for (const effect of [...effects.roster].reverse()) {
    const entry = await ctx.db.get("rosterEntries", effect.entryId);
    if (!entry) continue;
    const current = fieldsOf(entry);
    if (effect.created) {
      if (untouchedSince(current, effect)) await ctx.db.delete("rosterEntries", entry._id);
      continue;
    }
    const patch = undoPatch(current, effect);
    const keys = Object.keys(patch) as RosterField[];
    if (keys.length) await ctx.db.patch("rosterEntries", entry._id, toPatch(patch, keys));
  }
  for (const playerId of effects.retired) {
    const player = await ctx.db.get("players", playerId);
    if (player?.retired) await ctx.db.patch("players", playerId, { retired: false });
  }
}
