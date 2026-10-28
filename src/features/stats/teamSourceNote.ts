import type { StatTrend } from "@shared/stats/teamTrends";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Where a season's team stat values came from, as one line under the ribbons; null when none show. */
export function sourceNote(trends: readonly StatTrend[], year: number, games: number): string | null {
  const points = trends.flatMap((t) => t.points.filter((p) => p.year === year));
  const fromGames = points.filter((p) => p.source === "games").length;
  const captured = points.length - fromGames;
  const parts = [
    fromGames > 0 ? `${plural(fromGames, "stat")} from ${plural(games, "game")}` : null,
    captured > 0 ? `${captured} from the captured season screen` : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")}. Captured values replace game totals; league ranks come only from captures.`;
}
