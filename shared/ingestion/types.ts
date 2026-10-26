/**
 * Normalized drafts: what an extraction becomes after the model's JSON is checked and mapped
 * onto the stat registries, and what the review screen edits before commit. Generic over the
 * player id type so Convex can use its branded `Id<"players">` and shared code plain strings.
 */
import type { Position } from "../domain/positions";
import type { StatLine } from "../stats/registry";
import type { TeamStatLine } from "../stats/teamRegistry";

/** The score header both game targets carry. Team fields are abbreviations from `NFL_TEAMS`. */
export type GameHeader = {
  homeAbbr: string | null;
  awayAbbr: string | null;
  homeScore: number | null;
  awayScore: number | null;
  overtime: boolean;
  /** Points per quarter, overtime periods appended; null when the screenshot has no line score. */
  lineScore: { home: number[]; away: number[] } | null;
};

export type MatchStatus = "matched" | "ambiguous" | "new";

export type MatchCandidate<P extends string = string> = { playerId: P; name: string; score: number };

/** How a printed name resolved against the rosters: the chosen player and the runners-up. */
export type PlayerMatch<P extends string = string> = {
  status: MatchStatus;
  candidates: MatchCandidate<P>[];
};

/** One player's line in one game, merged across the category screens it appeared on. */
export type DraftLine<P extends string = string> = {
  /** Stable within a draft; review edits and confidence paths refer to it. */
  id: string;
  teamAbbr: string | null;
  /** The name as printed on the screenshot. */
  name: string;
  position: Position | null;
  stats: StatLine;
  /** The player this line commits to; null creates a new player. */
  playerId: P | null;
  match: PlayerMatch<P>;
};

export type BoxScoreDraft<P extends string = string> = {
  target: "game_box_score";
  game: GameHeader;
  lines: DraftLine<P>[];
};

export type TeamStatsDraft = {
  target: "team_game_stats";
  game: GameHeader;
  teams: { teamAbbr: string | null; stats: TeamStatLine }[];
};

export type Draft<P extends string = string> = BoxScoreDraft<P> | TeamStatsDraft;

export type WarningSeverity = "info" | "warning" | "error";
export type DraftWarning = { path?: string; message: string; severity: WarningSeverity };

/** Confidence from 0 to 1 per field path (`lines.<id>.stats.passYds`, `game.homeScore`). */
export type FieldConfidence = { path: string; value: number };
