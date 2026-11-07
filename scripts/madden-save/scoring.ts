/**
 * A game's scoring summary from the save's `ScoringSummary` rows. Each row holds both scores just
 * before and just after the play itself: a touchdown's row stops at the six, and its try only
 * shows in the next row's "previous" score (or, for the last score, in the final). So a row says
 * what the play was worth, and the gap to the next row says how the try went.
 */
import { PAT_LABELS, type PatResult } from "../../shared/domain/scoring";
import type { ScoringPlay } from "./types";

export type SummaryRow = {
  quarter: number;
  /** Seconds left in the period. */
  timeLeft: number;
  homePrevious: number;
  homeCurrent: number;
  awayPrevious: number;
  awayCurrent: number;
  /** The try that was converted: "FieldGoal" (kick), "Touchdown" (two points) or "None". */
  conversion: string;
};

type Side = "home" | "away";

const TRY: Record<number, PatResult> = { 1: "kick", 2: "two" };

/** A try that scored nothing reads "None", so a missed kick and a failed two-pointer look alike. */
function tryResult(points: number, conversion: string): PatResult | null {
  const scored = TRY[points];
  if (scored) return scored;
  if (conversion === "FieldGoal") return "kick_failed";
  if (conversion === "Touchdown") return "two_failed";
  return null;
}

function describe(points: number, pat: PatResult | null): Pick<ScoringPlay, "kind" | "pat" | "description"> {
  if (points === 3) return { kind: "fg", pat: null, description: "Field goal" };
  if (points === 2) return { kind: "safety", pat: null, description: "Safety" };
  if (points === 6) {
    const tried = pat ? PAT_LABELS[pat].toLowerCase() : "try no good";
    // The save names no scorer and no kind of touchdown; review picks both from the box score.
    return { kind: "other", pat, description: `Touchdown, ${tried} (play not in the save)` };
  }
  return { kind: "other", pat: null, description: `${points} points` };
}

/** The plays in game order, each with the score after it, its try included. */
export function scoringPlays(
  rows: readonly SummaryRow[],
  final: { home: number; away: number },
  abbr: { home: string; away: string },
): ScoringPlay[] {
  const ordered = [...rows].sort((a, b) => a.quarter - b.quarter || b.timeLeft - a.timeLeft);
  const plays: ScoringPlay[] = [];
  ordered.forEach((row, i) => {
    const up = { home: row.homeCurrent - row.homePrevious, away: row.awayCurrent - row.awayPrevious };
    const side: Side | null = up.home > 0 ? "home" : up.away > 0 ? "away" : null;
    if (!side) return;
    const points = up[side];
    const now = side === "home" ? row.homeCurrent : row.awayCurrent;
    const next = ordered[i + 1];
    const after = next ? (side === "home" ? next.homePrevious : next.awayPrevious) : final[side];
    // Only a touchdown has a try, and a try is worth 0 to 2.
    const gap = after - now;
    const tryPoints = points === 6 && gap >= 0 && gap <= 2 ? gap : 0;
    const pat = points === 6 ? tryResult(tryPoints, row.conversion) : null;
    plays.push({
      order: plays.length + 1,
      period: row.quarter,
      clock: row.timeLeft,
      teamAbbr: abbr[side],
      ...describe(points, pat),
      homeScore: row.homeCurrent + (side === "home" ? tryPoints : 0),
      awayScore: row.awayCurrent + (side === "away" ? tryPoints : 0),
    });
  });
  return plays;
}
