/** What a season is on course for (`docs/STATS-HUB.md` 4.4). Worked out on read; every number is a projection. */
import { safeDiv } from "./math";

/** Projects a partial-season total onto a full season. */
export function seasonPace(total: number, gamesPlayed: number, gamesPerSeason: number): number | null {
  const rate = safeDiv(total, gamesPlayed);
  return rate === null ? null : rate * gamesPerSeason;
}

export type PaceTarget<K extends string = string> = { key: K; target: number };

export type PaceCheck<K extends string = string> = PaceTarget<K> & {
  projected: number | null;
  onPace: boolean;
  /** Per game from here to reach it; zero once reached, null with no games left. */
  perGameNeeded: number | null;
};

export function paceTargets<K extends string>(
  total: number,
  gamesPlayed: number,
  gamesPerSeason: number,
  targets: readonly PaceTarget<K>[],
): PaceCheck<K>[] {
  const projected = seasonPace(total, gamesPlayed, gamesPerSeason);
  const left = gamesPerSeason - gamesPlayed;
  return targets.map(({ key, target }) => {
    const reached = total >= target;
    return {
      key,
      target,
      projected,
      onPace: reached || (projected !== null && projected >= target),
      perGameNeeded: reached ? 0 : left > 0 ? (target - total) / left : null,
    };
  });
}

const PYTHAGOREAN_EXPONENT = 2.37;

/** Wins a points differential is worth over `games`. Null before anyone has scored. */
export function pythagoreanWins(pointsFor: number, pointsAgainst: number, games: number): number | null {
  const scored = pointsFor ** PYTHAGOREAN_EXPONENT;
  const allowed = pointsAgainst ** PYTHAGOREAN_EXPONENT;
  const rate = safeDiv(scored, scored + allowed);
  return rate === null ? null : rate * games;
}

export type TeamPace = {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

/** The record and points a season is on course for. */
export function teamPace(sofar: TeamPace, gamesPerSeason: number): TeamPace | null {
  const played = sofar.wins + sofar.losses + sofar.ties;
  if (played === 0) return null;
  const project = (n: number) => (n / played) * gamesPerSeason;
  return {
    wins: project(sofar.wins),
    losses: project(sofar.losses),
    ties: project(sofar.ties),
    pointsFor: project(sofar.pointsFor),
    pointsAgainst: project(sofar.pointsAgainst),
  };
}
