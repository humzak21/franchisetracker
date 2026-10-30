/** Who a recorded move names: an existing player, or a new one typed into the form. */
import { v, type Infer } from "convex/values";
import { newPlayerName } from "../../shared/players/identity";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";
import { vPosition } from "../lib/validators";
import { provenanceOf } from "../players/provenance";

export const vPersonInput = v.union(
  v.object({ playerId: v.id("players") }),
  v.object({
    name: v.string(),
    position: vPosition,
    age: v.optional(v.number()),
    ovr: v.optional(v.number()),
  }),
);
type PersonInput = Infer<typeof vPersonInput>;

const MAX_NAME = 60;

const inRange = (value: number | undefined, min: number, max: number) =>
  value === undefined || (Number.isInteger(value) && value >= min && value <= max);

export type ResolvedPerson = {
  player: Doc<"players">;
  /** Rating and age typed for a player this move created, for their new roster entry. */
  extras?: { ovr?: number; age?: number };
};

/** Resolves each person, creating players typed by name, dated to the move's season. */
export async function resolvePeople(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  season: Doc<"seasons">,
  people: readonly PersonInput[],
): Promise<ResolvedPerson[]> {
  const out: ResolvedPerson[] = [];
  for (const person of people) {
    if ("playerId" in person) {
      const player = must(await ctx.db.get("players", person.playerId), "Player");
      if (player.franchiseId !== franchiseId) throw invalid("That player is in another franchise");
      out.push({ player });
      continue;
    }
    const name = person.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > MAX_NAME) throw invalid("Give the new player a name");
    if (!inRange(person.age, 18, 50)) throw invalid("Ages run from 18 to 50");
    if (!inRange(person.ovr, 1, 99)) throw invalid("OVR runs from 1 to 99");
    const id = await ctx.db.insert("players", {
      franchiseId,
      ...newPlayerName(name),
      position: person.position,
      ...(person.age !== undefined ? { ageAnchor: { age: person.age, year: season.year } } : {}),
      ...(await provenanceOf(ctx, franchiseId, season._id, "manual")),
      retired: false,
    });
    out.push({
      player: must(await ctx.db.get("players", id), "New player"),
      extras: { ovr: person.ovr, age: person.age },
    });
  }
  return out;
}
