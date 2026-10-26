/** The season laid out on the calendar (FEATURES.md 5.2): each game on its week's Sunday, plus offseason dates. */
import { weekLabel, weekPhase, type GameResult, type GameStatus, type WeekKey } from "../domain/calendar";
import { dayKey, offseasonMarkers, weekDate } from "./dates";

export type CalendarTone = "win" | "loss" | "tie" | "upcoming" | "bye" | "marker";

export type CalendarEntry = {
  date: Date;
  /** Short tag on the day: "W3", "WC", "Draft". */
  tag: string;
  /** One line: "vs PIT · L 20-23", "Bye week", "Free agency opens". */
  detail: string;
  tone: CalendarTone;
  playoff: boolean;
  gameId?: string;
};

export type CalendarGame = {
  _id: string;
  weekKey: WeekKey;
  status: GameStatus;
  result: GameResult | null;
  us: number | null;
  them: number | null;
  userIsHome: boolean | null;
  opponentAbbr: string | null;
};

const TONE: Record<GameResult, CalendarTone> = { W: "win", L: "loss", T: "tie" };

function gameDetail(game: CalendarGame): string {
  if (game.status === "bye") return "Bye week";
  const where = game.userIsHome === false ? "at" : "vs";
  const opponent = game.opponentAbbr ? `${where} ${game.opponentAbbr}` : weekLabel(game.weekKey, "long");
  if (game.result && game.us !== null && game.them !== null) {
    return `${opponent} · ${game.result} ${game.us}-${game.them}`;
  }
  return opponent;
}

/** Calendar entries keyed by day ("2026-09-13"), games first and offseason markers after the season. */
export function calendarEntries(year: number, games: readonly CalendarGame[]): Map<string, CalendarEntry> {
  const entries = new Map<string, CalendarEntry>();
  for (const game of games) {
    const date = weekDate(year, game.weekKey);
    entries.set(dayKey(date), {
      date,
      tag: weekLabel(game.weekKey),
      detail: gameDetail(game),
      tone: game.status === "bye" ? "bye" : game.result ? TONE[game.result] : "upcoming",
      playoff: weekPhase(game.weekKey) === "postseason",
      gameId: game.status === "bye" ? undefined : game._id,
    });
  }
  for (const marker of offseasonMarkers(year)) {
    entries.set(dayKey(marker.date), {
      date: marker.date,
      // Tags fit a calendar day, so free agency is abbreviated there and spelled out in the detail.
      tag: marker.key === "draft" ? "Draft" : "FA",
      detail: marker.key === "draft" ? `${year + 1} NFL Draft` : "Free agency opens",
      tone: "marker",
      playoff: false,
    });
  }
  return entries;
}
