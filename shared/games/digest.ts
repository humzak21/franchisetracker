/**
 * The week in one card (FEATURES.md 5.1): the result, the stars, what it set and where it left
 * the team, written the same way on Home and in the text it copies. Pure.
 */
import { weekLabel, type GameResult, type WeekKey } from "../domain/calendar";
import type { DivisionMove } from "../league/divisionMove";
import { formatOrdinal, formatRecord } from "../stats/format";
import type { WLT } from "./summary";

export type WeekDigest = {
  teamName: string;
  opponentName: string;
  weekKey: WeekKey;
  result: GameResult;
  us: number;
  them: number;
  home: boolean;
  overtime: boolean;
  record: WLT;
  streak: string | null;
  stars: { name: string; statLine: string | null }[];
  /** Records broken, then the rest of what the game raised. */
  records: string[];
  milestones: string[];
  division: string;
  standing: DivisionMove | null;
};

/** "2nd in the NFC East, up from 3rd". */
export function standingLine(standing: DivisionMove, division: string) {
  const place = `${formatOrdinal(standing.rank)} in the ${division}`;
  if (standing.rank === standing.previous) return place;
  const way = standing.rank < standing.previous ? "up" : "down";
  return `${place}, ${way} from ${formatOrdinal(standing.previous)}`;
}

/** "Week 9: W 31-24 vs Cowboys, OT". */
export function digestHeadline(d: WeekDigest) {
  const score = `${d.result} ${d.us}-${d.them}`;
  const where = `${d.home ? "vs" : "at"} ${d.opponentName}`;
  return `${weekLabel(d.weekKey, "long")}: ${score} ${where}${d.overtime ? ", OT" : ""}`;
}

/** "9-3, W4". */
export function digestRecord(d: WeekDigest) {
  return [formatRecord(d.record), d.streak].filter(Boolean).join(", ");
}

const bullets = (lines: readonly string[]) => lines.map((line) => `- ${line}`);

/** The digest as text to paste into a message. */
export function digestText(d: WeekDigest): string {
  const stars = d.stars.map((s) => (s.statLine ? `${s.name}: ${s.statLine}` : s.name));
  return [
    `${d.teamName} ${digestHeadline(d)}`,
    [digestRecord(d), d.standing && standingLine(d.standing, d.division)].filter(Boolean).join(" · "),
    ...bullets(stars),
    ...bullets(d.records),
    ...bullets(d.milestones),
  ].join("\n");
}
