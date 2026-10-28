/** Commit for every row target, keyed by target so a new one does not typecheck until it commits. */
import type { RowTargetKey } from "../../shared/ingestion/rows/targets";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";
import type { DraftContext } from "./commitGame";
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
  commitLeagueTeamStats,
  commitSeasonStats,
  commitStandings,
  commitTeamSeasonStats,
} from "./commitSeasonRows";
import { commitRecordsList } from "./commitRecordRows";
import type { RowCommit, RowCommitResult, StoredRowsDraft } from "./rowCommit";
import { commitLeagueSchedule } from "./commitSchedule";

const COMMITS: Record<RowTargetKey, (ctx: MutationCtx, commit: RowCommit) => Promise<RowCommitResult>> = {
  season_player_stats: commitSeasonStats,
  league_leaders: commitLeagueLeaders,
  records_list: commitRecordsList,
  team_season_stats: commitTeamSeasonStats,
  league_team_stats: commitLeagueTeamStats,
  standings: commitStandings,
  league_schedule: commitLeagueSchedule,
  weekly_awards: commitWeeklyAwards,
  yearly_awards: commitYearlyAwards,
  draft_results: commitDraftResults,
  roster_page: commitRosterPage,
  transactions: commitTransactions,
  injury_report: commitInjuryReport,
  player_card: commitPlayerCard,
};

/** Writes the accepted rows of a reviewed list into the season (and week) it is filed under. */
export async function commitRows(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  context: DraftContext,
  draft: StoredRowsDraft,
): Promise<RowCommitResult> {
  const game = context.gameId ? await ctx.db.get("games", context.gameId) : null;
  const seasonId = game?.seasonId ?? context.seasonId;
  if (!seasonId) throw invalid("Tag the screenshots with a season first");
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  return await COMMITS[draft.target](ctx, {
    franchise,
    season,
    weekKey: game?.weekKey ?? context.weekKey,
    meta: draft.meta,
    rows: draft.rows.filter((r) => r.accepted),
  });
}
