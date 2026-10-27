/**
 * Schema v1, composed from one file per domain under `convex/schema/`.
 * Data model reference: docs/FEATURES.md section 4.
 */
import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import { awardTables } from "./schema/awards";
import { draftTables } from "./schema/draft";
import { franchiseTables } from "./schema/franchise";
import { gameTables } from "./schema/games";
import { goalTables } from "./schema/goals";
import { historyTables } from "./schema/history";
import { hofTables } from "./schema/hof";
import { ingestionTables } from "./schema/ingestion";
import { leagueTables } from "./schema/league";
import { opsTables } from "./schema/ops";
import { playerTables } from "./schema/players";
import { statTables } from "./schema/stats";
import { transactionTables } from "./schema/transactions";

export default defineSchema({
  // users, sessions, accounts and tokens for Convex Auth (Sign in with Vercel).
  ...authTables,
  ...franchiseTables,
  ...leagueTables,
  ...playerTables,
  ...gameTables,
  ...goalTables,
  ...statTables,
  ...awardTables,
  ...draftTables,
  ...transactionTables,
  ...hofTables,
  ...historyTables,
  ...ingestionTables,
  ...opsTables,
});
