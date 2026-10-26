/**
 * Schema v1, composed from one file per domain under `convex/schema/`.
 * Data model reference: docs/FEATURES.md section 4.
 */
import { defineSchema } from "convex/server";
import { awardTables } from "./schema/awards";
import { draftTables } from "./schema/draft";
import { franchiseTables } from "./schema/franchise";
import { gameTables } from "./schema/games";
import { hofTables } from "./schema/hof";
import { ingestionTables } from "./schema/ingestion";
import { leagueTables } from "./schema/league";
import { playerTables } from "./schema/players";
import { statTables } from "./schema/stats";
import { transactionTables } from "./schema/transactions";

export default defineSchema({
  ...franchiseTables,
  ...leagueTables,
  ...playerTables,
  ...gameTables,
  ...statTables,
  ...awardTables,
  ...draftTables,
  ...transactionTables,
  ...hofTables,
  ...ingestionTables,
});
