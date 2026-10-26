/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as dev_fixtureHistory from "../dev/fixtureHistory.js";
import type * as dev_fixtureLines from "../dev/fixtureLines.js";
import type * as dev_fixtures from "../dev/fixtures.js";
import type * as external_espn from "../external/espn.js";
import type * as external_media from "../external/media.js";
import type * as external_openrouter from "../external/openrouter.js";
import type * as franchise_create from "../franchise/create.js";
import type * as franchise_franchises from "../franchise/franchises.js";
import type * as franchise_settings from "../franchise/settings.js";
import type * as franchise_setup from "../franchise/setup.js";
import type * as games_boxScore from "../games/boxScore.js";
import type * as games_schedule from "../games/schedule.js";
import type * as games_validators from "../games/validators.js";
import type * as games_views from "../games/views.js";
import type * as history_importJob from "../history/importJob.js";
import type * as history_importPlayers from "../history/importPlayers.js";
import type * as history_importSeasons from "../history/importSeasons.js";
import type * as history_importStats from "../history/importStats.js";
import type * as history_importValidators from "../history/importValidators.js";
import type * as history_imports from "../history/imports.js";
import type * as history_nflverseImport from "../history/nflverseImport.js";
import type * as history_timeline from "../history/timeline.js";
import type * as history_trophies from "../history/trophies.js";
import type * as hof_entries from "../hof/entries.js";
import type * as http from "../http.js";
import type * as ingestion_candidates from "../ingestion/candidates.js";
import type * as ingestion_commitBoxScore from "../ingestion/commitBoxScore.js";
import type * as ingestion_commitGame from "../ingestion/commitGame.js";
import type * as ingestion_commitTeamStats from "../ingestion/commitTeamStats.js";
import type * as ingestion_extract from "../ingestion/extract.js";
import type * as ingestion_fixture from "../ingestion/fixture.js";
import type * as ingestion_inbox from "../ingestion/inbox.js";
import type * as ingestion_jobs from "../ingestion/jobs.js";
import type * as ingestion_models from "../ingestion/models.js";
import type * as ingestion_review from "../ingestion/review.js";
import type * as ingestion_sets from "../ingestion/sets.js";
import type * as ingestion_settings from "../ingestion/settings.js";
import type * as ingestion_shortcut from "../ingestion/shortcut.js";
import type * as ingestion_tokens from "../ingestion/tokens.js";
import type * as ingestion_uploads from "../ingestion/uploads.js";
import type * as league_logos from "../league/logos.js";
import type * as league_seed from "../league/seed.js";
import type * as league_teams from "../league/teams.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_draftValidators from "../lib/draftValidators.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_franchise from "../lib/franchise.js";
import type * as lib_hof from "../lib/hof.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_needs from "../lib/needs.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_refs from "../lib/refs.js";
import type * as lib_reports from "../lib/reports.js";
import type * as lib_testOwner from "../lib/testOwner.js";
import type * as lib_validators from "../lib/validators.js";
import type * as players_compare from "../players/compare.js";
import type * as players_directory from "../players/directory.js";
import type * as players_espn from "../players/espn.js";
import type * as players_gameLog from "../players/gameLog.js";
import type * as players_headshots from "../players/headshots.js";
import type * as players_identity from "../players/identity.js";
import type * as players_merge from "../players/merge.js";
import type * as players_player from "../players/player.js";
import type * as players_progression from "../players/progression.js";
import type * as players_roster from "../players/roster.js";
import type * as players_search from "../players/search.js";
import type * as schema_awards from "../schema/awards.js";
import type * as schema_draft from "../schema/draft.js";
import type * as schema_franchise from "../schema/franchise.js";
import type * as schema_games from "../schema/games.js";
import type * as schema_history from "../schema/history.js";
import type * as schema_hof from "../schema/hof.js";
import type * as schema_ingestion from "../schema/ingestion.js";
import type * as schema_league from "../schema/league.js";
import type * as schema_players from "../schema/players.js";
import type * as schema_stats from "../schema/stats.js";
import type * as schema_transactions from "../schema/transactions.js";
import type * as seasons_lifecycle from "../seasons/lifecycle.js";
import type * as seasons_needs from "../seasons/needs.js";
import type * as seasons_reports from "../seasons/reports.js";
import type * as seasons_staff from "../seasons/staff.js";
import type * as stats_load from "../stats/load.js";
import type * as stats_milestones from "../stats/milestones.js";
import type * as stats_recompute from "../stats/recompute.js";
import type * as stats_records from "../stats/records.js";
import type * as stats_refresh from "../stats/refresh.js";
import type * as stats_refreshRecords from "../stats/refreshRecords.js";
import type * as stats_refreshStreaks from "../stats/refreshStreaks.js";
import type * as stats_season from "../stats/season.js";
import type * as stats_streaks from "../stats/streaks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  "dev/fixtureHistory": typeof dev_fixtureHistory;
  "dev/fixtureLines": typeof dev_fixtureLines;
  "dev/fixtures": typeof dev_fixtures;
  "external/espn": typeof external_espn;
  "external/media": typeof external_media;
  "external/openrouter": typeof external_openrouter;
  "franchise/create": typeof franchise_create;
  "franchise/franchises": typeof franchise_franchises;
  "franchise/settings": typeof franchise_settings;
  "franchise/setup": typeof franchise_setup;
  "games/boxScore": typeof games_boxScore;
  "games/schedule": typeof games_schedule;
  "games/validators": typeof games_validators;
  "games/views": typeof games_views;
  "history/importJob": typeof history_importJob;
  "history/importPlayers": typeof history_importPlayers;
  "history/importSeasons": typeof history_importSeasons;
  "history/importStats": typeof history_importStats;
  "history/importValidators": typeof history_importValidators;
  "history/imports": typeof history_imports;
  "history/nflverseImport": typeof history_nflverseImport;
  "history/timeline": typeof history_timeline;
  "history/trophies": typeof history_trophies;
  "hof/entries": typeof hof_entries;
  http: typeof http;
  "ingestion/candidates": typeof ingestion_candidates;
  "ingestion/commitBoxScore": typeof ingestion_commitBoxScore;
  "ingestion/commitGame": typeof ingestion_commitGame;
  "ingestion/commitTeamStats": typeof ingestion_commitTeamStats;
  "ingestion/extract": typeof ingestion_extract;
  "ingestion/fixture": typeof ingestion_fixture;
  "ingestion/inbox": typeof ingestion_inbox;
  "ingestion/jobs": typeof ingestion_jobs;
  "ingestion/models": typeof ingestion_models;
  "ingestion/review": typeof ingestion_review;
  "ingestion/sets": typeof ingestion_sets;
  "ingestion/settings": typeof ingestion_settings;
  "ingestion/shortcut": typeof ingestion_shortcut;
  "ingestion/tokens": typeof ingestion_tokens;
  "ingestion/uploads": typeof ingestion_uploads;
  "league/logos": typeof league_logos;
  "league/seed": typeof league_seed;
  "league/teams": typeof league_teams;
  "lib/auth": typeof lib_auth;
  "lib/draftValidators": typeof lib_draftValidators;
  "lib/errors": typeof lib_errors;
  "lib/franchise": typeof lib_franchise;
  "lib/hof": typeof lib_hof;
  "lib/media": typeof lib_media;
  "lib/needs": typeof lib_needs;
  "lib/owner": typeof lib_owner;
  "lib/refs": typeof lib_refs;
  "lib/reports": typeof lib_reports;
  "lib/testOwner": typeof lib_testOwner;
  "lib/validators": typeof lib_validators;
  "players/compare": typeof players_compare;
  "players/directory": typeof players_directory;
  "players/espn": typeof players_espn;
  "players/gameLog": typeof players_gameLog;
  "players/headshots": typeof players_headshots;
  "players/identity": typeof players_identity;
  "players/merge": typeof players_merge;
  "players/player": typeof players_player;
  "players/progression": typeof players_progression;
  "players/roster": typeof players_roster;
  "players/search": typeof players_search;
  "schema/awards": typeof schema_awards;
  "schema/draft": typeof schema_draft;
  "schema/franchise": typeof schema_franchise;
  "schema/games": typeof schema_games;
  "schema/history": typeof schema_history;
  "schema/hof": typeof schema_hof;
  "schema/ingestion": typeof schema_ingestion;
  "schema/league": typeof schema_league;
  "schema/players": typeof schema_players;
  "schema/stats": typeof schema_stats;
  "schema/transactions": typeof schema_transactions;
  "seasons/lifecycle": typeof seasons_lifecycle;
  "seasons/needs": typeof seasons_needs;
  "seasons/reports": typeof seasons_reports;
  "seasons/staff": typeof seasons_staff;
  "stats/load": typeof stats_load;
  "stats/milestones": typeof stats_milestones;
  "stats/recompute": typeof stats_recompute;
  "stats/records": typeof stats_records;
  "stats/refresh": typeof stats_refresh;
  "stats/refreshRecords": typeof stats_refreshRecords;
  "stats/refreshStreaks": typeof stats_refreshStreaks;
  "stats/season": typeof stats_season;
  "stats/streaks": typeof stats_streaks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
