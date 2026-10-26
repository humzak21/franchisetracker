/**
 * The Apple Shortcut endpoint (docs/SHORTCUT.md): the only unauthenticated surface besides
 * Convex Auth's own routes, guarded by a revocable bearer token instead of a session.
 *
 *   GET  /shortcut/targets   the menu: targets from the registry, week keys, the current season
 *   POST /shortcut/upload    multipart `image` files plus `target`, optional `week` and `season` (year);
 *                            a missing week is inferred from the target and the schedule. Optional
 *                            `batch` and `batchSize` gather one image per request into one set.
 */
import { ConvexError, v } from "convex/values";
import { WEEK_KEYS, isWeekKey, weekLabel } from "../../shared/domain";
import { lastPlayedWeek, nextWeek } from "../../shared/games/summary";
import { INGESTION_TARGETS, TARGET_KEYS, isTargetKey } from "../../shared/ingestion/targets";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { httpAction, internalQuery, type ActionCtx } from "../_generated/server";
import type { AppErrorData } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vWeekKey } from "../lib/validators";
import { MAX_SET_SIZE } from "./sets";
import { sha256Hex } from "./tokens";

const MAX_GAMES_PER_SEASON = 40;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The optional batch fields; a string is the reason they are unusable. */
function parseBatch(form: FormData): { key: string; size: number } | undefined | string {
  const key = String(form.get("batch") ?? "");
  const sizeText = String(form.get("batchSize") ?? "");
  if (!key && !sizeText) return undefined;
  const size = Number(sizeText);
  if (!/^[\w-]{1,64}$/.test(key) || !Number.isInteger(size) || size < 1 || size > MAX_SET_SIZE) {
    return `Send \`batch\` (letters, digits, - or _) with \`batchSize\` between 1 and ${MAX_SET_SIZE}`;
  }
  return { key, size };
}

async function authorized(ctx: ActionCtx, request: Request): Promise<boolean> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return false;
  return await ctx.runMutation(internal.ingestion.tokens.verify, { tokenHash: await sha256Hex(token) });
}

/**
 * The season a capture belongs to (the requested year, else the one being played), the week a
 * new game screen most likely is (the one after the latest result) and the week just played
 * (for weekly screens such as awards and the injury report).
 */
export const season = internalQuery({
  args: { year: v.optional(v.number()) },
  returns: v.union(
    v.object({ _id: v.id("seasons"), year: v.number(), nextWeek: vWeekKey, lastWeek: vWeekKey }),
    v.null(),
  ),
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
    if (!found) return null;
    const games = await ctx.db
      .query("games")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", found._id))
      .take(MAX_GAMES_PER_SEASON);
    const next = nextWeek(games);
    return { _id: found._id, year: found.year, nextWeek: next, lastWeek: lastPlayedWeek(games) ?? next };
  },
});

export const targets = httpAction(async (ctx, request) => {
  if (!(await authorized(ctx, request))) return json({ error: "Invalid or revoked token" }, 401);
  const current = await ctx.runQuery(internal.ingestion.shortcut.season, {});
  // Shortcuts' "Choose from List" shows a list of strings; the dictionaries map a label back to its key.
  const targetLabels = TARGET_KEYS.map((key) => INGESTION_TARGETS[key].label);
  const weekLabels = WEEK_KEYS.map((key) => weekLabel(key, "long"));
  return json({
    season: current?.year ?? null,
    suggestedWeek: current ? weekLabel(current.nextWeek, "long") : null,
    targetLabels,
    targetByLabel: Object.fromEntries(TARGET_KEYS.map((key, i) => [targetLabels[i], key])),
    weekLabels,
    weekByLabel: Object.fromEntries(WEEK_KEYS.map((key, i) => [weekLabels[i], key])),
    // Season screens (standings, leaders) skip the week question; the others suggest one.
    asksWeekByLabel: Object.fromEntries(
      TARGET_KEYS.map((key, i) => [targetLabels[i], INGESTION_TARGETS[key].scope !== "season"]),
    ),
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
  const batch = parseBatch(form);
  if (typeof batch === "string") return json({ error: batch }, 400);
  const notImage = files.find((file) => !file.type.startsWith("image/"));
  if (notImage) return json({ error: `${notImage.name || "A file"} is not an image` }, 400);

  const storageIds: Id<"_storage">[] = [];
  for (const file of files) storageIds.push(await ctx.storage.store(file));
  const targetKey = target && isTargetKey(target) ? target : undefined;
  const scope = targetKey ? INGESTION_TARGETS[targetKey].scope : undefined;
  // Context inference: without a week, a game screen is the next game, a weekly one the week just played.
  const weekKey =
    week && isWeekKey(week)
      ? week
      : scope === "game"
        ? season.nextWeek
        : scope === "week"
          ? season.lastWeek
          : undefined;
  let sets: string[];
  try {
    sets = await ctx.runMutation(internal.ingestion.shortcutUploads.create, {
      storageIds,
      targetKey,
      seasonId: season._id,
      weekKey,
      batch,
    });
  } catch (error) {
    // Nothing was recorded, so the stored files would be orphans.
    await Promise.allSettled(storageIds.map((id) => ctx.storage.delete(id)));
    if (error instanceof ConvexError) return json({ error: (error.data as AppErrorData).message }, 400);
    throw error;
  }
  return json({ ok: true, sets: sets.length, images: storageIds.length });
});
