/**
 * Commit for a records list: each row becomes a typed record in the team or all-time book,
 * replacing the one already typed for the same player (and season, outside careers), so a list
 * read twice or corrected never doubles up. The list's placements follow.
 */
import { isRecordScope } from "../../shared/stats/records";
import { normalizeName } from "../../shared/stats/recordBoards";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid } from "../lib/errors";
import { typedFor, writePlacements } from "../stats/boards";
import { checkTypedRecord } from "../stats/typedRecords";
import { numberOf, teamCache, type RowCommit, type RowCommitResult } from "./rowCommit";

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

export async function commitRecordsList(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const book = text(commit.meta.book);
  const scope = text(commit.meta.scope);
  const split = text(commit.meta.split) ?? "regular";
  const statKey = text(commit.meta.stat);
  if ((book !== "team" && book !== "league") || !scope || !isRecordScope(scope) || !statKey) {
    throw invalid("Pick the book, kind and stat the list ranks");
  }
  if (split !== "regular" && split !== "postseason") throw invalid("Pick regular season or playoffs");
  const key = { split, scope, statKey } as const;
  const franchise = commit.franchise;
  const team = teamCache(ctx);
  const typed = await typedFor(ctx, franchise._id, book, key);

  for (const row of commit.rows) {
    const name = row.name?.trim() ?? "";
    const value = numberOf(row, "value");
    const year = numberOf(row, "year");
    if (value === undefined) throw invalid(`${name || "A row"} has no number`);
    checkTypedRecord({ statKey, name, value, year });
    // A team the app does not know (a defunct franchise) leaves the entry without one.
    let teamId: Id<"teams"> | undefined;
    try {
      teamId = row.teamAbbr ? (await team(row.teamAbbr))._id : undefined;
    } catch {
      teamId = undefined;
    }
    const fields = {
      name,
      playerId: row.playerId ?? undefined,
      teamId,
      year,
      value,
    };
    const same = typed.find(
      (t) =>
        (row.playerId ? t.playerId === row.playerId : normalizeName(t.name) === normalizeName(name)) &&
        (scope === "career" || t.year === year),
    );
    if (same) await ctx.db.patch("typedRecords", same._id, fields);
    else {
      const id = await ctx.db.insert("typedRecords", { franchiseId: franchise._id, book, ...key, ...fields });
      typed.push({ _id: id, _creationTime: 0, franchiseId: franchise._id, book, ...key, ...fields });
    }
  }
  await writePlacements(ctx, franchise, book, key);
  return {};
}
