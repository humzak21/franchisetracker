/**
 * Pure helpers for editing a draft in review. Paths are the same ones confidence and warnings
 * use: `game.homeScore`, `lines.<id>.stats.passYds`, `lines.<id>.name`, `teams.0.stats.totalYds`.
 */
import { isRawStatKey, getStat } from "@shared/stats";
import { isTeamStatKey, TEAM_STATS } from "@shared/stats/teamRegistry";
import { CHECK_BELOW, ROW_CHECK_BELOW, deriveDraft } from "@shared/ingestion/normalize";
import { isRowDraft, rowTarget } from "@shared/ingestion/targets";
import type { Position } from "@shared/domain";
import { PROSPECT_ESPN_ID } from "@shared/ingestion/rows/peopleSpecs";
import { scoringPlaysSpec } from "@shared/ingestion/rows/scoringSpec";
import type { Draft, DraftWarning, FieldConfidence, PlayerMatch } from "@shared/ingestion/types";

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
  return deriveDraft(write(draft, 0) as D);
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

/** "D. Maye · Passing yards", "Home score", "NE · Total yards", "BUF · Wins". */
export function fieldLabel(draft: Draft, path: string): string {
  const [root, id, field, key] = path.split(".");
  if (root === "game") return HEADER_LABELS[id ?? ""] ?? id ?? path;
  if (root === "lines" && "lines" in draft) {
    const line = draft.lines.find((l) => l.id === id);
    const who = line?.name ?? "Player";
    if (field === "stats" && key) return `${who} · ${statLabel(key)}`;
    if (field === "teamAbbr") return `${who} · Team`;
    return who;
  }
  if (root === "plays" && "plays" in draft) {
    const row = draft.plays?.find((r) => r.id === id);
    const who = row?.name ?? row?.teamAbbr ?? "Play";
    if (field === "teamAbbr") return `${who} · Team`;
    const label = scoringPlaysSpec.fields().find((f) => f.key === key)?.label;
    return field === "values" && label ? `${who} · ${label}` : who;
  }
  if (isRowDraft(draft)) {
    const { spec } = rowTarget(draft.target);
    if (root === "meta") return spec.meta.find((f) => f.key === id)?.label ?? id ?? path;
    const row = draft.rows.find((r) => r.id === id);
    const who = row?.name ?? row?.teamAbbr ?? "Row";
    if (field === "values" && key)
      return `${who} · ${spec.fields(draft).find((f) => f.key === key)?.label ?? statLabel(key)}`;
    if (field === "teamAbbr") return `${who} · Team`;
    return who;
  }
  if (root === "teams" && "teams" in draft) {
    const team = draft.teams[Number(id)]?.teamAbbr ?? `Team ${Number(id) + 1}`;
    return key ? `${team} · ${statLabel(key)}` : team;
  }
  return path;
}

/** The confidence below which a field is called out in this draft. */
export const checkBelow = (draft: Draft) => (isRowDraft(draft) ? ROW_CHECK_BELOW : CHECK_BELOW);

export type AttentionItem = {
  path: string;
  label: string;
  confidence: number | null;
  warning: DraftWarning | null;
};

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
    if (c.value >= checkBelow(draft) || getAt(draft, c.path) === undefined) continue;
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

/**
 * Who a printed name is, as review decides it: a franchise player, a new player (named as printed
 * or as typed), or a college prospect found on ESPN, who joins as a new player with his ESPN id.
 */
export type PlayerChoice =
  | { kind: "player"; _id: string; name: string }
  | { kind: "new"; name: string }
  | { kind: "prospect"; espnId: number; name: string; position: Position | null; college: string | null };

/**
 * Applies a reviewed player choice. Choosing a known player keeps the name printed on the
 * screenshot; a new player or a prospect takes the name chosen, since that is who gets created.
 */
export function choosePlayerAt<D extends Draft>(draft: D, base: string, choice: PlayerChoice): D {
  const match = getAt(draft, `${base}.match`) as PlayerMatch | null;
  const others = (id?: string) => match?.candidates.filter((c) => c.playerId !== id) ?? [];
  if (choice.kind === "player") {
    return setAt(setAt(draft, `${base}.playerId`, choice._id), `${base}.match`, {
      status: "matched",
      candidates: [{ playerId: choice._id, name: choice.name, score: 1 }, ...others(choice._id)],
    });
  }
  let next = setAt(draft, `${base}.playerId`, null);
  next = setAt(next, `${base}.match`, { status: "new", candidates: others() });
  next = setAt(next, `${base}.name`, choice.name);
  const values = getAt(next, `${base}.values`) as Record<string, unknown> | undefined;
  if (!values) return next;
  if (choice.kind === "new") {
    return values[PROSPECT_ESPN_ID] === undefined
      ? next
      : setAt(next, `${base}.values.${PROSPECT_ESPN_ID}`, undefined);
  }
  next = setAt(next, `${base}.values.${PROSPECT_ESPN_ID}`, choice.espnId);
  if (choice.college) next = setAt(next, `${base}.values.college`, choice.college);
  if (choice.position && (values.position ?? null) === null) {
    next = setAt(next, `${base}.values.position`, choice.position);
  }
  return next;
}
