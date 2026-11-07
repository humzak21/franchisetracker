import type { StatTrend } from "@shared/stats/teamTrends";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Where a season's team stat values came from, as one line under the cards; null when none show. */
export function sourceNote(trends: readonly StatTrend[], year: number, games: number): string | null {
  const points = trends.flatMap((t) => t.points.filter((p) => p.year === year));
  const count = (source: string) => points.filter((p) => p.source === source).length;
  const fromGames = count("games");
  const league = count("league");
  const captured = count("captured");
  const parts = [
    fromGames > 0 ? `${plural(fromGames, "stat")} from ${plural(games, "game")}` : null,
    league > 0 ? `${league} from League → Teams` : null,
    captured > 0 ? `${captured} captured or entered` : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")}. Entered values win, then League → Teams, then the games. Ranks and league averages come from League → Teams unless the season screen was captured.`;
}
