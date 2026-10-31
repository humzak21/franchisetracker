/** Madden's league leaders screens (FEATURES.md 5.5): how the user's team stands among the top twenty. */

export type LeaderRow<T extends string = string> = {
  statKey: string;
  rank: number;
  teamId: T | null;
};

/** Top-twenty spots the team holds, and its best-placed player on each stat, best first. */
export function whereWeRank<R extends LeaderRow>(rows: readonly R[], userTeamId: string) {
  const ours = rows.filter((r) => r.teamId === userTeamId);
  const best = new Map<string, R>();
  for (const row of ours) {
    const prior = best.get(row.statKey);
    if (!prior || row.rank < prior.rank) best.set(row.statKey, row);
  }
  return {
    spots: ours.length,
    topFive: ours.filter((r) => r.rank <= 5).length,
    leaders: ours.filter((r) => r.rank === 1).length,
    best: [...best.values()].sort((a, b) => a.rank - b.rank),
  };
}
