/**
 * The Apple Shortcut endpoint (docs/SHORTCUT.md): the only unauthenticated surface besides
 * Convex Auth's own routes, guarded by a revocable bearer token instead of a session.
 *
 *   GET  /shortcut/targets   the menu: targets from the registry, week keys, the current season
 *   POST /shortcut/upload    multipart `image` files plus `target`, `week`, optional `season` (year)
 */
import { v } from "convex/values";
import { WEEK_KEYS, isWeekKey, weekLabel } from "../../shared/domain";
import { INGESTION_TARGETS, TARGET_KEYS, isTargetKey } from "../../shared/ingestion/targets";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { httpAction, internalQuery, type ActionCtx } from "../_generated/server";
import { activeFranchise } from "../lib/franchise";
import { MAX_SET_SIZE } from "./sets";
import { sha256Hex } from "./tokens";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function authorized(ctx: ActionCtx, request: Request): Promise<boolean> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return false;
  return await ctx.runMutation(internal.ingestion.tokens.verify, { tokenHash: await sha256Hex(token) });
}

/** The season a capture belongs to: the requested year, else the one being played. */
export const season = internalQuery({
  args: { year: v.optional(v.number()) },
  returns: v.union(v.object({ _id: v.id("seasons"), year: v.number() }), v.null()),
  handler: async (ctx, { year }) => {
    const franchise = await activeFranchise(ctx);
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id))
      .take(100);
    const found =
      year !== undefined
        ? seasons.find((s) => s.year === year)
        : (seasons.find((s) => s.status !== "complete") ?? seasons.at(-1));
    return found ? { _id: found._id, year: found.year } : null;
  },
});

export const targets = httpAction(async (ctx, request) => {
  if (!(await authorized(ctx, request))) return json({ error: "Invalid or revoked token" }, 401);
  const current = await ctx.runQuery(internal.ingestion.shortcut.season, {});
  return json({
    season: current?.year ?? null,
    targets: TARGET_KEYS.map((key) => ({
      key,
      label: INGESTION_TARGETS[key].label,
      multiImage: INGESTION_TARGETS[key].multiImage,
    })),
    weeks: WEEK_KEYS.map((key) => ({ key, label: weekLabel(key, "long") })),
  });
});

export const upload = httpAction(async (ctx, request) => {
  if (!(await authorized(ctx, request))) return json({ error: "Invalid or revoked token" }, 401);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Send multipart form data with one or more `image` files" }, 400);
  }
  const files = form.getAll("image").filter((f): f is File => typeof f !== "string");
  if (files.length === 0 || files.length > MAX_SET_SIZE) {
    return json({ error: `Attach between 1 and ${MAX_SET_SIZE} images` }, 400);
  }
  const target = String(form.get("target") ?? "");
  const week = String(form.get("week") ?? "");
  const yearText = String(form.get("season") ?? "");
  if (target && !isTargetKey(target)) return json({ error: `Unknown target "${target}"` }, 400);
  if (week && !isWeekKey(week)) return json({ error: `Unknown week "${week}"` }, 400);
  const year = yearText ? Number(yearText) : undefined;
  if (year !== undefined && !Number.isInteger(year)) return json({ error: "Season must be a year" }, 400);
  const season = await ctx.runQuery(internal.ingestion.shortcut.season, { year });
  if (!season) return json({ error: "No such season in the franchise" }, 400);

  const storageIds: Id<"_storage">[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/"))
      return json({ error: `${file.name || "A file"} is not an image` }, 400);
    storageIds.push(await ctx.storage.store(file));
  }
  const sets = await ctx.runMutation(internal.ingestion.uploads.createFromShortcut, {
    storageIds,
    targetKey: target && isTargetKey(target) ? target : undefined,
    seasonId: season._id,
    weekKey: week && isWeekKey(week) ? week : undefined,
  });
  return json({ ok: true, sets: sets.length, images: storageIds.length });
});
