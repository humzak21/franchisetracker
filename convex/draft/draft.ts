/**
 * Draft (FEATURES.md 5.9): a season's draft with the user team's picks graded in hindsight, and
 * the history of every class the franchise drafted.
 */
import { v } from "convex/values";
import { AWARD_INFO } from "../../shared/domain";
import { gradeClass, gradePick, type PickGrade } from "../../shared/draft/grade";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";
import { vPosition } from "../lib/validators";

/** A full draft is about 260 picks. */
const MAX_PICKS = 300;
const MAX_ROWS = 160;
const MAX_NOTE = 500;

const vGrade = v.union(v.object({ score: v.number(), letter: v.string() }), v.null());

/**
 * How a user pick turned out: peak OVR on the user team's roster entries since the draft,
 * regular-season games for the team, and honors, over the seasons completed since.
 */
async function gradeFor(
  ctx: QueryCtx,
  pick: Doc<"draftPicks">,
  draftYear: number,
  completed: readonly Doc<"seasons">[],
  userTeamId: Id<"teams">,
): Promise<PickGrade | null> {
  const since = completed.filter((s) => s.year >= draftYear);
  if (!pick.playerId || since.length === 0) return null;
  const playerId = pick.playerId;
  const ids = new Set(since.map((s) => s._id));
  const [entries, stats, awards] = await Promise.all([
    ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS),
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS),
    ctx.db
      .query("awards")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS),
  ]);
  const ours = (r: { seasonId: Id<"seasons">; teamId?: Id<"teams"> }) =>
    ids.has(r.seasonId) && r.teamId === userTeamId;
  return gradePick({
    round: pick.round,
    ovrAtDraft: pick.ovrAtDraft,
    ovrs: entries.filter(ours).flatMap((e) => (e.ovr === undefined ? [] : [e.ovr])),
    gamesPlayed: stats.filter((s) => ours(s) && s.split === "regular").reduce((n, s) => n + s.gamesPlayed, 0),
    honors: awards.filter((a) => ids.has(a.seasonId) && AWARD_INFO[a.type].cadence !== "weekly").length,
    seasonsSince: since.length,
  });
}

const completedSeasons = async (ctx: QueryCtx, franchiseId: Id<"franchises">) =>
  (await franchiseSeasonList(ctx, franchiseId)).filter((s) => s.status === "complete");

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    year: v.number(),
    classGrade: vGrade,
    picks: v.array(
      v.object({
        _id: v.id("draftPicks"),
        round: v.number(),
        overall: v.number(),
        pickInRound: v.optional(v.number()),
        team: vTeamRef,
        isUser: v.boolean(),
        name: v.string(),
        player: v.union(
          v.object({
            _id: v.id("players"),
            displayName: v.string(),
            position: vPosition,
            headshotUrl: v.union(v.string(), v.null()),
          }),
          v.null(),
        ),
        position: v.optional(vPosition),
        college: v.optional(v.string()),
        ovrAtDraft: v.optional(v.number()),
        notes: v.optional(v.string()),
        tradeNote: v.optional(v.string()),
        originTeam: v.union(vTeamRef, v.null()),
        grade: vGrade,
      }),
    ),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = must(await ctx.db.get("seasons", seasonId), "Season");
    const [picks, teams, completed] = await Promise.all([
      ctx.db
        .query("draftPicks")
        .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", seasonId))
        .take(MAX_PICKS),
      teamsById(ctx),
      completedSeasons(ctx, franchise._id),
    ]);
    const players = await playersById(
      ctx,
      picks.flatMap((p) => (p.playerId ? [p.playerId] : [])),
    );
    const userPicks = picks.filter((p) => p.teamId === franchise.userTeamId);
    const photos = await headshotUrls(
      ctx,
      userPicks.flatMap((p) => (p.playerId && players.has(p.playerId) ? [players.get(p.playerId)!] : [])),
    );
    const grades = new Map(
      await Promise.all(
        userPicks.map(
          async (p) => [p._id, await gradeFor(ctx, p, season.year, completed, franchise.userTeamId)] as const,
        ),
      ),
    );
    return {
      year: season.year,
      classGrade: gradeClass([...grades.values()]),
      picks: picks.flatMap((p) => {
        const team = teams.get(p.teamId);
        if (!team) return [];
        const player = p.playerId ? players.get(p.playerId) : undefined;
        const origin = p.originTeamId ? teams.get(p.originTeamId) : undefined;
        return [
          {
            _id: p._id,
            round: p.round,
            overall: p.overall,
            pickInRound: p.pickInRound,
            team: toTeamRef(team),
            isUser: p.teamId === franchise.userTeamId,
            name: player?.displayName ?? p.rawName ?? "Unknown",
            player: player
              ? {
                  _id: player._id,
                  displayName: player.displayName,
                  position: player.position,
                  headshotUrl: photos.get(player._id) ?? null,
                }
              : null,
            position: p.position,
            college: p.college,
            ovrAtDraft: p.ovrAtDraft,
            notes: p.notes,
            tradeNote: p.tradeNote,
            originTeam: origin ? toTeamRef(origin) : null,
            grade: grades.get(p._id) ?? null,
          },
        ];
      }),
    };
  },
});

/** Every class the user team drafted, newest first, with its first pick and grade. */
export const history = query({
  args: {},
  returns: v.array(
    v.object({
      year: v.number(),
      seasonId: v.id("seasons"),
      picks: v.number(),
      firstPick: v.object({ round: v.number(), overall: v.number(), name: v.string() }),
      classGrade: vGrade,
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [picks, seasons] = await Promise.all([
      ctx.db
        .query("draftPicks")
        .withIndex("by_franchiseId_and_teamId", (q) =>
          q.eq("franchiseId", franchise._id).eq("teamId", franchise.userTeamId),
        )
        .take(MAX_PICKS),
      franchiseSeasonList(ctx, franchise._id),
    ]);
    const completed = seasons.filter((s) => s.status === "complete");
    const players = await playersById(
      ctx,
      picks.flatMap((p) => (p.playerId ? [p.playerId] : [])),
    );
    const out = [];
    for (const season of [...seasons].sort((a, b) => b.year - a.year)) {
      const cls = picks.filter((p) => p.seasonId === season._id).sort((a, b) => a.overall - b.overall);
      const first = cls[0];
      if (!first) continue;
      const grades = await Promise.all(
        cls.map((p) => gradeFor(ctx, p, season.year, completed, franchise.userTeamId)),
      );
      out.push({
        year: season.year,
        seasonId: season._id,
        picks: cls.length,
        firstPick: {
          round: first.round,
          overall: first.overall,
          name: (first.playerId && players.get(first.playerId)?.displayName) || first.rawName || "Unknown",
        },
        classGrade: gradeClass(grades),
      });
    }
    return out;
  },
});

/** The owner's notes on a pick: how it went, and where a traded pick came from. */
export const updatePick = mutation({
  args: { pickId: v.id("draftPicks"), notes: v.optional(v.string()), tradeNote: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { pickId, notes, tradeNote }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("draftPicks", pickId), "Draft pick");
    for (const text of [notes, tradeNote])
      if (text && text.length > MAX_NOTE) throw invalid(`Keep notes under ${MAX_NOTE} characters`);
    await ctx.db.patch("draftPicks", pickId, {
      ...(notes !== undefined ? { notes: notes.trim() || undefined } : {}),
      ...(tradeNote !== undefined ? { tradeNote: tradeNote.trim() || undefined } : {}),
    });
    return null;
  },
});
