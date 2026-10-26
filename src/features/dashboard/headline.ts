import { PLAYOFF_RESULT_LABELS, type PlayoffResult, type SeasonStatus } from "@shared/domain";
import type { WLT } from "@shared/games/summary";
import { formatOrdinal, formatRecord, formatSigned } from "@shared/stats";

type HeadlineInput = {
  status: SeasonStatus;
  /** Captured regular-season record; falls back to the season's stored record (imported seasons). */
  regular: WLT | null;
  stored?: { w: number; l: number; t: number; playoffResult?: PlayoffResult } | null;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
  divisionRank: number | null;
  seed: number | null;
  division: string;
};

export type HeadlineFact = { label: string; value: string; detail?: string };

/** The season header's facts (FEATURES.md 5.1): record, division standing, streak, point differential, playoffs. */
export function headlineFacts(input: HeadlineInput): HeadlineFact[] {
  const regular =
    input.regular && input.regular.w + input.regular.l + input.regular.t > 0 ? input.regular : input.stored;
  const played = input.pointsFor + input.pointsAgainst > 0;
  const result = input.stored?.playoffResult;
  const playoffs = result
    ? {
        value: result === "champion" ? "Champs" : result === "missed" ? "Out" : "Lost",
        detail: PLAYOFF_RESULT_LABELS[result],
      }
    : input.seed !== null
      ? { value: `#${input.seed}`, detail: "Playoff seed" }
      : input.status === "complete" || input.status === "upcoming"
        ? { value: "—", detail: input.status === "upcoming" ? "Season not started" : "Season over" }
        : { value: "Alive", detail: "In the hunt" };
  return [
    { label: "Record", value: regular ? formatRecord(regular) : "0-0", detail: "Regular season" },
    {
      label: "Division",
      value: input.divisionRank !== null ? formatOrdinal(input.divisionRank) : "—",
      detail: input.division,
    },
    { label: "Streak", value: input.streak ?? "—", detail: "Current" },
    {
      label: "Point diff",
      value: played ? formatSigned(input.pointsFor - input.pointsAgainst) : "—",
      detail: played ? `${input.pointsFor}-${input.pointsAgainst}` : "No scores yet",
    },
    { label: "Playoffs", ...playoffs },
  ];
}
