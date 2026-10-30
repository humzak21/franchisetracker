/**
 * Who a draft row is: the pick already committed at that slot, or a player created this season
 * (typed in earlier, a partial read) who agrees on name and on college or position. Draft classes
 * are mostly new players, so a name alone is never enough to settle it. Pure.
 */
import { positionGroupOf, isPosition } from "../domain/positions";
import { matchPlayer, nameTokens, type NameCandidate } from "./nameMatch";
import { rowOverallPick } from "./rows/peopleSpecs";
import type { DraftRow } from "./rows/types";
import type { PlayerMatch } from "./types";

export type DraftPoolPlayer<P extends string = string> = NameCandidate<P> & { college: string | null };
export type CommittedPick<P extends string = string> = { overall: number; player: DraftPoolPlayer<P> };

const SURE_NAME = 0.9;

/** Near enough that a recommit of this slot means the same player, misread or corrected. */
export const fitsPick = (
  name: string,
  player: Pick<NameCandidate, "displayName" | "firstName" | "lastName" | "aliases">,
) => matchPlayer(name, [{ ...player, playerId: "pick" }]).status !== "new";

const sameCollege = (a: string, b: string) => nameTokens(a).join("") === nameTokens(b).join("");

const samePositionGroup = (a: string, b: string) =>
  isPosition(a) && isPosition(b) && positionGroupOf(a) === positionGroupOf(b);

export function matchDraftRow<P extends string>(
  row: Pick<DraftRow, "name" | "values">,
  pool: readonly DraftPoolPlayer<P>[],
  picks: readonly CommittedPick<P>[],
): PlayerMatch<P> {
  const none: PlayerMatch<P> = { status: "new", candidates: [] };
  if (!row.name) return none;
  const overall = rowOverallPick(row);
  const pick = picks.find((p) => p.overall === overall);
  if (pick && fitsPick(row.name, pick.player)) {
    const { playerId, displayName: name } = pick.player;
    return { status: "matched", candidates: [{ playerId, name, score: 1 }] };
  }
  const college = typeof row.values.college === "string" ? row.values.college : null;
  const position = typeof row.values.position === "string" ? row.values.position : null;
  const byId = new Map(pool.map((p) => [p.playerId, p]));
  const fits = matchPlayer(row.name, pool).candidates.flatMap((candidate) => {
    const player = byId.get(candidate.playerId);
    if (!player) return [];
    const collegeAgrees = college && player.college ? sameCollege(college, player.college) : null;
    const positionAgrees = position && player.position ? samePositionGroup(position, player.position) : null;
    if (collegeAgrees === false || positionAgrees === false) return [];
    return [{ candidate, corroborated: collegeAgrees === true || positionAgrees === true }];
  });
  const [best] = fits;
  if (!best) return none;
  const candidates = fits.map((f) => f.candidate);
  const settled = fits.length === 1 && best.corroborated && best.candidate.score >= SURE_NAME;
  return { status: settled ? "matched" : "ambiguous", candidates };
}
