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
import type * as franchise_franchises from "../franchise/franchises.js";
import type * as franchise_seed from "../franchise/seed.js";
import type * as http from "../http.js";
import type * as league_teams from "../league/teams.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_testOwner from "../lib/testOwner.js";
import type * as lib_validators from "../lib/validators.js";
import type * as schema_awards from "../schema/awards.js";
import type * as schema_draft from "../schema/draft.js";
import type * as schema_franchise from "../schema/franchise.js";
import type * as schema_games from "../schema/games.js";
import type * as schema_hof from "../schema/hof.js";
import type * as schema_ingestion from "../schema/ingestion.js";
import type * as schema_league from "../schema/league.js";
import type * as schema_players from "../schema/players.js";
import type * as schema_stats from "../schema/stats.js";
import type * as schema_transactions from "../schema/transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  "franchise/franchises": typeof franchise_franchises;
  "franchise/seed": typeof franchise_seed;
  http: typeof http;
  "league/teams": typeof league_teams;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/owner": typeof lib_owner;
  "lib/testOwner": typeof lib_testOwner;
  "lib/validators": typeof lib_validators;
  "schema/awards": typeof schema_awards;
  "schema/draft": typeof schema_draft;
  "schema/franchise": typeof schema_franchise;
  "schema/games": typeof schema_games;
  "schema/hof": typeof schema_hof;
  "schema/ingestion": typeof schema_ingestion;
  "schema/league": typeof schema_league;
  "schema/players": typeof schema_players;
  "schema/stats": typeof schema_stats;
  "schema/transactions": typeof schema_transactions;
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
