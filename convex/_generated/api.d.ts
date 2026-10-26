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
import type * as dev_fixtures from "../dev/fixtures.js";
import type * as external_openrouter from "../external/openrouter.js";
import type * as franchise_create from "../franchise/create.js";
import type * as franchise_franchises from "../franchise/franchises.js";
import type * as franchise_setup from "../franchise/setup.js";
import type * as games_boxScore from "../games/boxScore.js";
import type * as games_schedule from "../games/schedule.js";
import type * as games_validators from "../games/validators.js";
import type * as games_views from "../games/views.js";
import type * as history_trophies from "../history/trophies.js";
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
import type * as league_seed from "../league/seed.js";
import type * as league_teams from "../league/teams.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_draftValidators from "../lib/draftValidators.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_franchise from "../lib/franchise.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_testOwner from "../lib/testOwner.js";
import type * as lib_validators from "../lib/validators.js";
import type * as players_player from "../players/player.js";
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
import type * as stats_recompute from "../stats/recompute.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  "dev/fixtures": typeof dev_fixtures;
  "external/openrouter": typeof external_openrouter;
  "franchise/create": typeof franchise_create;
  "franchise/franchises": typeof franchise_franchises;
  "franchise/setup": typeof franchise_setup;
  "games/boxScore": typeof games_boxScore;
  "games/schedule": typeof games_schedule;
  "games/validators": typeof games_validators;
  "games/views": typeof games_views;
  "history/trophies": typeof history_trophies;
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
  "league/seed": typeof league_seed;
  "league/teams": typeof league_teams;
  "lib/auth": typeof lib_auth;
  "lib/draftValidators": typeof lib_draftValidators;
  "lib/errors": typeof lib_errors;
  "lib/franchise": typeof lib_franchise;
  "lib/owner": typeof lib_owner;
  "lib/testOwner": typeof lib_testOwner;
  "lib/validators": typeof lib_validators;
  "players/player": typeof players_player;
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
  "stats/recompute": typeof stats_recompute;
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
