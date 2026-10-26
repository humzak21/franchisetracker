/** Commit for every row target, keyed by target so a new one does not typecheck until it commits. */
import type { RowTargetKey } from "../../shared/ingestion/rows/targets";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";
import {
  commitDraftResults,
  commitInjuryReport,
  commitPlayerCard,
  commitRosterPage,
  commitTransactions,
  commitWeeklyAwards,
  commitYearlyAwards,
} from "./commitPeopleRows";
import {
  commitLeagueLeaders,
  commitSeasonStats,
  commitStandings,
  commitTeamSeasonStats,
} from "./commitSeasonRows";
import type { RowCommit, RowCommitResult, StoredRowsDraft } from "./rowCommit";

const COMMITS: Record<RowTargetKey, (ctx: MutationCtx, commit: RowCommit) => Promise<RowCommitResult>> = {
  season_player_stats: commitSeasonStats,
  league_leaders: commitLeagueLeaders,
  team_season_stats: commitTeamSeasonStats,
  standings: commitStandings,
  weekly_awards: commitWeeklyAwards,
  yearly_awards: commitYearlyAwards,
  draft_results: commitDraftResults,
  roster_page: commitRosterPage,
  transactions: commitTransactions,
  injury_report: commitInjuryReport,
  player_card: commitPlayerCard,
};

/** Writes the accepted rows of a reviewed list into the season (and week) the set was tagged with. */
export async function commitRows(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  lead: Doc<"uploads">,
  draft: StoredRowsDraft,
): Promise<RowCommitResult> {
  const game = lead.gameId ? await ctx.db.get("games", lead.gameId) : null;
  const seasonId = game?.seasonId ?? lead.seasonId;
  if (!seasonId) throw invalid("Tag the screenshots with a season first");
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  return await COMMITS[draft.target](ctx, {
    franchise,
    season,
    weekKey: game?.weekKey ?? lead.weekKey,
    meta: draft.meta,
    rows: draft.rows.filter((r) => r.accepted),
  });
}
