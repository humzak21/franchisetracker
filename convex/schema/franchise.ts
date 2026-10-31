import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vNeedPriority,
  vPlayoffResult,
  vPosition,
  vPromptStatus,
  vSeasonStatus,
  vStatMap,
} from "../lib/validators";

const vPrompt = v.object({
  status: vPromptStatus,
  answeredAt: v.optional(v.number()),
  /** Dismissing hides the prompt for the session; it stays pending until answered. */
  dismissedAt: v.optional(v.number()),
});

export const franchiseTables = {
  franchises: defineTable({
    name: v.string(),
    userTeamId: v.id("teams"),
    startYear: v.number(),
    settings: v.object({
      gamesPerSeason: v.number(),
      playoffTeams: v.number(),
      /**
       * Per-stat overrides of the registry's elite thresholds, keyed by stat key.
       * `tier1` is the first highlight level, `tier2` the higher one.
       */
      thresholdOverrides: v.optional(
        v.record(v.string(), v.object({ tier1: v.number(), tier2: v.optional(v.number()) })),
      ),
      /** The same overrides for one game's numbers (box scores, game logs), over `DEFAULT_GAME_TIERS`. */
      gameThresholdOverrides: v.optional(
        v.record(v.string(), v.object({ tier1: v.number(), tier2: v.optional(v.number()) })),
      ),
      /** OpenRouter model choices for extraction. */
      models: v.optional(
        v.object({
          primary: v.optional(v.string()),
          fallback: v.optional(v.string()),
          temperature: v.optional(v.number()),
          maxTokens: v.optional(v.number()),
          /** Model ids saved for the pickers, on top of the defaults. */
          presets: v.optional(v.array(v.string())),
        }),
      ),
    }),
    isActive: v.boolean(),
    /** When it last stopped being the active one; deleting the active franchise falls back to the latest. */
    lastActiveAt: v.optional(v.number()),
    /** Set when the owner deletes the franchise; its rows are being removed in the background. */
    deletingAt: v.optional(v.number()),
  }).index("by_isActive", ["isActive"]),

  seasons: defineTable({
    franchiseId: v.id("franchises"),
    year: v.number(),
    status: vSeasonStatus,
    /** User-team record cache, refreshed whenever a game is committed. */
    userRecord: v.optional(
      v.object({
        w: v.number(),
        l: v.number(),
        t: v.number(),
        divisionRank: v.optional(v.number()),
        seed: v.optional(v.number()),
        playoffResult: v.optional(vPlayoffResult),
      }),
    ),
    /**
     * User-team season team stats derived from its regular-season games (`TEAM_SEASON_STATS`
     * keys), refreshed with `userRecord`. Captured `teamSeasonStats` rows override them.
     */
    teamTotals: v.optional(v.object({ games: v.number(), statGames: v.number(), stats: vStatMap })),
    coaching: v.optional(
      v.object({
        headCoach: v.optional(v.string()),
        offensiveCoordinator: v.optional(v.string()),
        defensiveCoordinator: v.optional(v.string()),
        offensiveScheme: v.optional(v.string()),
        defensiveScheme: v.optional(v.string()),
      }),
    ),
    salaryCap: v.optional(v.number()),
    /** The season's retirements list has been gone through. */
    retirementsReviewed: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  }).index("by_franchiseId_and_year", ["franchiseId", "year"]),

  /** One per season. */
  seasonReports: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    preseasonThoughts: v.optional(v.string()),
    postseasonThoughts: v.optional(v.string()),
    aroundTheLeague: v.optional(v.string()),
    prompts: v.object({ preseason: vPrompt, postseason: vPrompt }),
    /**
     * Offseason needs checklist, written for the offseason after this season; a handful of rows
     * per season, so inline. Resolved by a transaction, a draft pick, or by hand with a note.
     */
    needs: v.array(
      v.object({
        key: v.string(),
        position: vPosition,
        priority: vNeedPriority,
        note: v.optional(v.string()),
        resolvedByTransactionId: v.optional(v.id("transactions")),
        resolvedByDraftPickId: v.optional(v.id("draftPicks")),
        resolvedAt: v.optional(v.number()),
        resolvedNote: v.optional(v.string()),
      }),
    ),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_franchiseId", ["franchiseId"]),
};
