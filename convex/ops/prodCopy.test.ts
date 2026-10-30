import { expect, test } from "vitest";
import { BACKUP_TABLES, NOT_BACKED_UP } from "../../shared/ops/backup";
import { SCRUBBED_TABLES, keptTables } from "../../shared/ops/prodCopy";
import schema from "../schema";

test("every table in the schema is kept in a production copy or scrubbed on purpose", () => {
  const kept = keptTables([...BACKUP_TABLES, ...Object.keys(NOT_BACKED_UP)]);
  const scrubbed = new Set(Object.keys(SCRUBBED_TABLES));
  const unclassified = Object.keys(schema.tables).filter((t) => !kept.has(t) && !scrubbed.has(t));
  expect(unclassified).toEqual([]);
});

test("Convex Auth's tables and the Shortcut tokens are never kept", () => {
  const kept = keptTables(Object.keys(schema.tables));
  const secrets = Object.keys(schema.tables).filter((t) => t === "users" || /^auth|Token/.test(t));
  expect(secrets.length).toBeGreaterThan(5);
  for (const table of secrets) expect(kept.has(table)).toBe(false);
});
