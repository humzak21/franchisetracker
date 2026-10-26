/**
 * Pure helpers for editing a draft in review. Paths are the same ones confidence and warnings
 * use: `game.homeScore`, `lines.<id>.stats.passYds`, `lines.<id>.name`, `teams.0.stats.totalYds`.
 */
import { isRawStatKey, getStat } from "@shared/stats";
import { isTeamStatKey, TEAM_STATS } from "@shared/stats/teamRegistry";
import type { Draft, DraftWarning, FieldConfidence } from "@shared/ingestion/types";

type Node = Record<string, unknown> | unknown[];

function child(node: Node, segment: string): unknown {
  if (Array.isArray(node)) {
    return node.find((item) => (item as { id?: string })?.id === segment) ?? node[Number(segment)];
  }
  return node[segment];
}

export function getAt(draft: Draft, path: string): unknown {
  let node: unknown = draft;
  for (const segment of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = child(node as Node, segment);
  }
  return node;
}

/** A copy of the draft with one value replaced; `undefined` removes the key (a cleared stat). */
export function setAt<D extends Draft>(draft: D, path: string, value: unknown): D {
  const segments = path.split(".");
  const write = (node: unknown, depth: number): unknown => {
    const segment = segments[depth] ?? "";
    const last = depth === segments.length - 1;
    if (Array.isArray(node)) {
      const index = node.findIndex((item) => (item as { id?: string })?.id === segment);
      const at = index >= 0 ? index : Number(segment);
      return node.map((item, i) => (i === at ? write(item, depth + 1) : item));
    }
    const obj = { ...(node as Record<string, unknown>) };
    if (last) {
      if (value === undefined) delete obj[segment];
      else obj[segment] = value;
    } else obj[segment] = write(obj[segment] ?? {}, depth + 1);
    return obj;
  };
  return write(draft, 0) as D;
}

const HEADER_LABELS: Record<string, string> = {
  homeAbbr: "Home team",
  awayAbbr: "Away team",
  homeScore: "Home score",
  awayScore: "Away score",
};

function statLabel(key: string): string {
  if (isRawStatKey(key)) return getStat(key).label;
  if (isTeamStatKey(key)) return TEAM_STATS[key].label;
  return key;
}

/** "D. Maye · Passing yards", "Home score", "NE · Total yards". */
export function fieldLabel(draft: Draft, path: string): string {
  const [root, id, field, key] = path.split(".");
  if (root === "game") return HEADER_LABELS[id ?? ""] ?? id ?? path;
  if (root === "lines" && draft.target === "game_box_score") {
    const line = draft.lines.find((l) => l.id === id);
    const who = line?.name ?? "Player";
    if (field === "stats" && key) return `${who} · ${statLabel(key)}`;
    if (field === "teamAbbr") return `${who} · Team`;
    return who;
  }
  if (root === "teams" && draft.target === "team_game_stats") {
    const team = draft.teams[Number(id)]?.teamAbbr ?? `Team ${Number(id) + 1}`;
    return key ? `${team} · ${statLabel(key)}` : team;
  }
  return path;
}

export type AttentionItem = {
  path: string;
  label: string;
  confidence: number | null;
  warning: DraftWarning | null;
};

/** Fields below this are listed for a look before commit. */
export const CHECK_BELOW = 0.8;
const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const;

/**
 * Fields worth a second look, most doubtful first: errors, then warnings, then low model
 * confidence. Paths that no longer exist (a removed line) drop out; `info` notes are not listed.
 */
export function attentionItems(
  draft: Draft,
  confidence: readonly FieldConfidence[],
  warnings: readonly DraftWarning[],
): AttentionItem[] {
  const byPath = new Map<string, AttentionItem>();
  for (const c of confidence) {
    if (c.value >= CHECK_BELOW || getAt(draft, c.path) === undefined) continue;
    byPath.set(c.path, {
      path: c.path,
      label: fieldLabel(draft, c.path),
      confidence: c.value,
      warning: null,
    });
  }
  for (const w of warnings) {
    if (!w.path || w.severity === "info") continue;
    const existing = byPath.get(w.path);
    byPath.set(w.path, {
      path: w.path,
      label: fieldLabel(draft, w.path),
      confidence: existing?.confidence ?? null,
      warning:
        existing?.warning && SEVERITY_RANK[existing.warning.severity] < SEVERITY_RANK[w.severity]
          ? existing.warning
          : w,
    });
  }
  const rank = (item: AttentionItem) => (item.warning ? SEVERITY_RANK[item.warning.severity] : 3);
  return [...byPath.values()].sort((a, b) => rank(a) - rank(b) || (a.confidence ?? 1) - (b.confidence ?? 1));
}

/** Parses what was typed into a stat field: empty clears it, anything unparseable is ignored. */
export function parseStat(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
