/**
 * Season reports (FEATURES.md 4.1, 5.1, 5.7): the pre- and post-season thoughts, around the
 * league, what is due, and the archive with each season's computed summary.
 */
import { v } from "convex/values";
import { seasonSummary } from "../../shared/games/summary";
import { isEliminated } from "../../shared/seasons/lifecycle";
import {
  duePrompts,
  isNeedOpen,
  REPORT_PROMPTS,
  reportSeasons,
  type ReportPrompts,
} from "../../shared/seasons/reports";
import { LEADER_STATS, teamLeaders } from "../../shared/seasons/summary";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import { resolutionLabels } from "../lib/needs";
import { headshotUrls } from "../lib/refs";
import {
  ensureReport,
  franchiseSeasonList,
  ownSeason,
  reportFor,
  seasonByYear,
  seasonGames,
} from "../lib/reports";
import { literals, vPosition, vNeedPriority, vRecord } from "../lib/validators";
import schema from "../schema";

/** A full roster plus the players who came and went fits well under this. */
const MAX_SEASON_ROWS = 150;
const MAX_TEXT = 20_000;

const vPrompt = literals(REPORT_PROMPTS);
const vTextField = literals(["preseasonThoughts", "postseasonThoughts", "aroundTheLeague"]);
const vSummary = v.object({
  regular: vRecord,
  postseason: vRecord,
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  streak: v.union(v.string(), v.null()),
  played: v.number(),
});

function summarize(games: Parameters<typeof seasonSummary>[0]) {
  return { ...seasonSummary(games), played: games.filter((g) => g.status === "played").length };
}

/** One season's report with the computed summary beside it: record, points, team leaders. */
export const get = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    season: schema.doc("seasons"),
    report: v.union(schema.doc("seasonReports"), v.null()),
    summary: vSummary,
    eliminated: v.boolean(),
    hasNextSeason: v.boolean(),
    leaders: v.array(
      v.object({
        stat: literals(LEADER_STATS),
        value: v.number(),
        player: v.object({
          _id: v.id("players"),
          displayName: v.string(),
          position: vPosition,
          headshotUrl: v.union(v.string(), v.null()),
        }),
      }),
    ),
    resolutions: v.array(v.object({ key: v.string(), label: v.string() })),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    const [report, games, rows, next] = await Promise.all([
      reportFor(ctx, seasonId),
      seasonGames(ctx, seasonId),
      ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_seasonId_and_teamId", (q) =>
          q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
        )
        .take(MAX_SEASON_ROWS),
      seasonByYear(ctx, franchise._id, season.year + 1),
    ]);
    const leaders = teamLeaders(rows.filter((r) => r.split === "regular"));
    const players = await playersById(
      ctx,
      leaders.map((l) => l.playerId),
    );
    const photos = await headshotUrls(ctx, players.values());
    return {
      season,
      report,
      summary: summarize(games),
      eliminated: isEliminated(games),
      hasNextSeason: next !== null,
      leaders: leaders.flatMap((l) => {
        const p = players.get(l.playerId);
        return p
          ? [
              {
                stat: l.stat,
                value: l.value,
                player: {
                  _id: p._id,
                  displayName: p.displayName,
                  position: p.position,
                  headshotUrl: photos.get(p._id) ?? null,
                },
              },
            ]
          : [];
      }),
      resolutions: report ? await resolutionLabels(ctx, report.needs) : [],
    };
  },
});

/**
 * What the dashboard card and the banner show: prompts that are due (answered ones drop off;
 * dismissed ones stay) and the open needs of the offseason being played through.
 */
export const pending = query({
  args: {},
  returns: v.object({
    prompts: v.array(
      v.object({
        seasonId: v.id("seasons"),
        year: v.number(),
        prompt: vPrompt,
        dismissedAt: v.optional(v.number()),
      }),
    ),
    needs: v.array(
      v.object({
        seasonId: v.id("seasons"),
        year: v.number(),
        key: v.string(),
        position: vPosition,
        priority: vNeedPriority,
        note: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const seasons = await franchiseSeasonList(ctx, franchise._id);
    const { current, lastComplete } = reportSeasons(seasons, franchise.startYear);
    const relevant = [lastComplete, current].filter((s) => s !== undefined);
    const reports = await Promise.all(relevant.map((s) => reportFor(ctx, s._id)));
    const prompts = new Map<Id<"seasons">, ReportPrompts>();
    reports.forEach((r) => r && prompts.set(r.seasonId, r.prompts));
    const needs = relevant.flatMap((season, i) =>
      (reports[i]?.needs ?? []).filter(isNeedOpen).map((need) => ({
        seasonId: season._id,
        year: season.year,
        key: need.key,
        position: need.position,
        priority: need.priority,
        note: need.note,
      })),
    );
    return { prompts: duePrompts(seasons, prompts, franchise.startYear), needs };
  },
});

const snippet = (text: string | undefined) => (text?.trim() ? text.trim().slice(0, 240) : undefined);

/** Every franchise season, newest first, with its report at a glance and its computed record. */
export const archive = query({
  args: {},
  returns: v.array(
    v.object({
      season: schema.doc("seasons"),
      summary: vSummary,
      preseason: v.object({ answered: v.boolean(), snippet: v.optional(v.string()) }),
      postseason: v.object({ answered: v.boolean(), snippet: v.optional(v.string()) }),
      aroundTheLeague: v.optional(v.string()),
      needs: v.object({ open: v.number(), total: v.number() }),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const seasons = (await franchiseSeasonList(ctx, franchise._id))
      .filter((s) => s.year >= franchise.startYear)
      .sort((a, b) => b.year - a.year);
    return await Promise.all(
      seasons.map(async (season) => {
        const [report, games] = await Promise.all([reportFor(ctx, season._id), seasonGames(ctx, season._id)]);
        return {
          season,
          summary: summarize(games),
          preseason: {
            answered: report?.prompts.preseason.status === "answered",
            snippet: snippet(report?.preseasonThoughts),
          },
          postseason: {
            answered: report?.prompts.postseason.status === "answered",
            snippet: snippet(report?.postseasonThoughts),
          },
          aroundTheLeague: snippet(report?.aroundTheLeague),
          needs: { open: report?.needs.filter(isNeedOpen).length ?? 0, total: report?.needs.length ?? 0 },
        };
      }),
    );
  },
});

/** Autosave for one of the report's text fields. */
export const saveText = mutation({
  args: { seasonId: v.id("seasons"), field: vTextField, text: v.string() },
  returns: v.null(),
  handler: async (ctx, { seasonId, field, text }) => {
    await requireOwner(ctx);
    if (text.length > MAX_TEXT) throw invalid(`Keep it under ${MAX_TEXT.toLocaleString()} characters`);
    const { season } = await ownSeason(ctx, seasonId);
    const report = await ensureReport(ctx, season);
    await ctx.db.patch("seasonReports", report._id, { [field]: text.trim() === "" ? undefined : text });
    return null;
  },
});

const PROMPT_FIELD = { preseason: "preseasonThoughts", postseason: "postseasonThoughts" } as const;

/** Files a report: the prompt stops being due. Its text stays editable afterwards. */
export const answer = mutation({
  args: { seasonId: v.id("seasons"), prompt: vPrompt },
  returns: v.null(),
  handler: async (ctx, { seasonId, prompt }) => {
    await requireOwner(ctx);
    const { season } = await ownSeason(ctx, seasonId);
    if (prompt === "postseason" && season.status !== "complete") {
      throw invalid(`The ${season.year} season is not over yet`);
    }
    const report = await ensureReport(ctx, season);
    if (!report[PROMPT_FIELD[prompt]]?.trim()) throw invalid("Write the report before filing it");
    if (report.prompts[prompt].status === "answered") return null;
    await ctx.db.patch("seasonReports", report._id, {
      prompts: { ...report.prompts, [prompt]: { status: "answered", answeredAt: Date.now() } },
    });
    return null;
  },
});

/** Hides the banner for a while (`PROMPT_SNOOZE_MS`); the prompt stays due and the dashboard keeps it. */
export const dismiss = mutation({
  args: { seasonId: v.id("seasons"), prompt: vPrompt },
  returns: v.null(),
  handler: async (ctx, { seasonId, prompt }) => {
    await requireOwner(ctx);
    const { season } = await ownSeason(ctx, seasonId);
    const report = await ensureReport(ctx, season);
    if (report.prompts[prompt].status === "answered") return null;
    await ctx.db.patch("seasonReports", report._id, {
      prompts: { ...report.prompts, [prompt]: { ...report.prompts[prompt], dismissedAt: Date.now() } },
    });
    return null;
  },
});
