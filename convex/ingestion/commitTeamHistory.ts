/**
 * Commit for team history: each accepted row writes one of the user team's seasons before the
 * franchise (`writeHistorySeason`), so a table read twice or corrected rewrites the same seasons.
 */
import { isPlayoffResult } from "../../shared/domain";
import { writeHistorySeason } from "../history/seasons";
import type { MutationCtx } from "../_generated/server";
import { invalid } from "../lib/errors";
import { numberOf, textOf, type RowCommit, type RowCommitResult } from "./rowCommit";

export async function commitTeamHistory(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  for (const row of commit.rows) {
    const year = numberOf(row, "year");
    if (year === undefined) throw invalid("Every row needs its season");
    const result = textOf(row, "playoffResult");
    await writeHistorySeason(ctx, commit.franchise, {
      year,
      record: {
        w: numberOf(row, "w") ?? 0,
        l: numberOf(row, "l") ?? 0,
        t: numberOf(row, "t") ?? 0,
        divisionRank: numberOf(row, "divisionRank"),
        seed: numberOf(row, "seed"),
        playoffResult: result && isPlayoffResult(result) ? result : undefined,
      },
      headCoach: textOf(row, "headCoach"),
      notes: textOf(row, "note"),
      pointsFor: numberOf(row, "pointsFor"),
      pointsAgainst: numberOf(row, "pointsAgainst"),
    });
  }
  return {};
}
