/**
 * One schema builder, normalizer, validator and merge for every row target (`./types.ts`).
 * The model's answer is untrusted: malformed fields become null, unknown teams a warning.
 */
import { normalizePosition } from "../../domain/positions";
import { resolveTeamAbbr } from "../../domain/teams";
import { extractionField } from "../../stats/registry";
import { nameTokens } from "../nameMatch";
import {
  CHECK_BELOW,
  clamp01,
  isObj,
  num,
  rowConfidence,
  rows as rowList,
  str,
  type Normalized,
  type Obj,
} from "../normalize";
import { nullable, object, rowMeta, type JsonSchema } from "../schema";
import type { DraftWarning, FieldConfidence } from "../types";
import type { DraftRow, RowField, RowSpec, RowValue, RowsDraft } from "./types";

export function fieldSchema(field: RowField): JsonSchema {
  const hint = field.hint ?? field.label;
  switch (field.type) {
    case "int":
      return nullable("integer", hint);
    case "number":
      return nullable("number", hint);
    case "bool":
      return nullable("boolean", hint);
    case "enum":
      return {
        type: ["string", "null"],
        enum: [...(field.options ?? []).map((o) => o.value), null],
        description: `${hint}: ${(field.options ?? []).map((o) => `${o.value} = ${o.label}`).join(", ")}`,
      };
    case "team":
      return nullable("string", `${hint} (abbreviation or name as printed)`);
    default:
      return nullable("string", hint);
  }
}

/** The fields a row object carries in the model's answer. */
export function rowProperties(spec: RowSpec, fields: readonly RowField[]): Record<string, JsonSchema> {
  return {
    ...(spec.player ? { name: { type: "string", description: "Player name exactly as printed." } } : {}),
    ...(spec.rowTeam ? { team: nullable("string", "The row's team as printed.") } : {}),
    ...Object.fromEntries(fields.map((f) => [extractionField(f.key), fieldSchema(f)])),
    ...rowMeta,
  };
}

export function rowsSchema(spec: RowSpec): JsonSchema {
  const meta = Object.fromEntries(spec.meta.map((f) => [extractionField(f.key), fieldSchema(f)]));
  const rows = spec.rowsSchema?.() ?? {
    rows: { type: "array", items: object(rowProperties(spec, spec.fields())) },
  };
  return object({ ...meta, ...rows });
}

/** A field's value from the model, or null when it is missing or not the right kind. */
export function readField(field: RowField, value: unknown): RowValue {
  switch (field.type) {
    case "int": {
      const n = num(value);
      return n === null ? null : Math.round(n);
    }
    case "number":
      return num(value);
    case "bool":
      return typeof value === "boolean" ? value : null;
    case "team":
      return resolveTeamAbbr(str(value));
    case "position": {
      const printed = str(value);
      return printed ? normalizePosition(printed) : null;
    }
    case "enum": {
      const printed = str(value)?.toLowerCase();
      if (!printed) return null;
      const hit = field.options?.find(
        (o) => o.value.toLowerCase() === printed || o.label.toLowerCase() === printed,
      );
      return hit?.value ?? null;
    }
    default:
      return str(value);
  }
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "row";

function rowId(identity: string, taken: Set<string>): string {
  const base = slug(identity);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/** Rows with the same identity in one answer (a player on two stat tabs) merge their values. */
function mergeValues(row: DraftRow, values: Record<string, RowValue>, warnings: DraftWarning[]) {
  for (const [key, value] of Object.entries(values)) {
    const existing = row.values[key];
    if (existing !== undefined && existing !== null && existing !== value) {
      warnings.push({
        path: `rows.${row.id}.values.${key}`,
        message: `${row.name ?? row.teamAbbr ?? "A row"}: two screenshots disagree (${String(existing)} and ${String(value)})`,
        severity: "warning",
      });
      continue;
    }
    row.values[key] = value;
  }
}

/** A name key that ignores case and punctuation, for row identities. */
export const nameKey = (name: string | null) => (name ? nameTokens(name).join(" ") : "");

export function normalizeRows<T extends string>(
  target: T,
  spec: RowSpec,
  raw: unknown,
): Normalized<RowsDraft<string, T>> {
  const warnings: DraftWarning[] = [];
  const confidence: FieldConfidence[] = [];
  const obj: Obj = isObj(raw) ? raw : {};
  const meta: Record<string, RowValue> = {};
  for (const field of spec.meta) {
    const printed = obj[extractionField(field.key)];
    const value = readField(field, printed);
    meta[field.key] = value;
    if (field.type === "team" && printed && value === null) {
      warnings.push({
        path: `meta.${field.key}`,
        message: `Unknown team "${String(printed)}"`,
        severity: "error",
      });
    }
  }
  const fields = spec.fields();
  const byIdentity = new Map<string, DraftRow>();
  const taken = new Set<string>();
  for (const row of spec.readRows ? spec.readRows(obj) : rowList(obj.rows)) {
    const name = spec.player ? str(row.name) : null;
    if (spec.player && !name) continue;
    const printedTeam = spec.rowTeam ? str(row.team) : null;
    const teamAbbr = resolveTeamAbbr(printedTeam);
    const values: Record<string, RowValue> = {};
    const paths: Record<string, string> = spec.player ? { name: "name" } : {};
    if (spec.rowTeam) paths.team = "teamAbbr";
    for (const field of fields) {
      const value = readField(field, row[extractionField(field.key)]);
      if (value === null) continue;
      values[field.key] = value;
      paths[extractionField(field.key)] = `values.${field.key}`;
    }
    if (Object.keys(values).length === 0 && !name) continue;
    const identity = spec.identity({ name, teamAbbr, values });
    const unclear = Array.isArray(row.unclear_fields) && row.unclear_fields.length > 0;
    const sure = clamp01(num(row.confidence)) >= CHECK_BELOW && !unclear;
    let draftRow = byIdentity.get(identity);
    if (draftRow) {
      mergeValues(draftRow, values, warnings);
      draftRow.accepted &&= sure;
    } else {
      draftRow = {
        id: rowId(identity, taken),
        accepted: sure,
        name,
        teamAbbr,
        values,
        playerId: null,
        match: spec.player ? { status: "new", candidates: [] } : null,
      };
      byIdentity.set(identity, draftRow);
    }
    if (printedTeam && !teamAbbr) {
      warnings.push({
        path: `rows.${draftRow.id}.teamAbbr`,
        message: `Unknown team "${printedTeam}"`,
        severity: "warning",
      });
    }
    rowConfidence(row, `rows.${draftRow.id}`, paths, confidence);
  }
  return { draft: { target, meta, rows: [...byIdentity.values()] }, confidence, warnings };
}

const missing = (value: RowValue | undefined) => value === undefined || value === null || value === "";

/** Checks every accepted row; rows left unaccepted are not committed, so they are not checked. */
export function validateRows(spec: RowSpec, draft: RowsDraft): DraftWarning[] {
  const out: DraftWarning[] = [];
  for (const field of spec.meta) {
    if (field.required && missing(draft.meta[field.key])) {
      out.push({ path: `meta.${field.key}`, message: `${field.label} is missing`, severity: "error" });
    }
  }
  const accepted = draft.rows.filter((r) => r.accepted);
  if (draft.rows.length === 0) out.push({ message: "There are no rows to commit", severity: "error" });
  else if (accepted.length === 0) {
    out.push({ message: "Accept at least one row to commit", severity: "error" });
  }
  const fields = spec.fields(draft);
  for (const row of accepted) {
    const who = row.name ?? row.teamAbbr ?? "A row";
    const path = `rows.${row.id}`;
    for (const field of fields) {
      if (field.required && missing(row.values[field.key])) {
        out.push({
          path: `${path}.values.${field.key}`,
          message: `${who}: ${field.label.toLowerCase()} is missing`,
          severity: "error",
        });
      }
    }
    if (spec.rowTeam && !row.teamAbbr && !spec.player) {
      out.push({ path: `${path}.teamAbbr`, message: `${who}: pick the team`, severity: "error" });
    }
    if (spec.player && row.playerId === null) {
      out.push(
        row.match?.status === "ambiguous"
          ? { path: `${path}.name`, message: `${who}: choose which player this is`, severity: "warning" }
          : { path: `${path}.name`, message: `${who} will be added as a new player`, severity: "info" },
      );
    }
  }
  return [...out, ...(spec.rules?.(draft) ?? [])];
}

/**
 * Several screenshots of one list read separately, then merged: the union of their rows, one
 * row per identity, with a warning wherever two screens disagree on a value.
 */
export function mergeRowDrafts<T extends string>(
  spec: RowSpec,
  parts: readonly Normalized<RowsDraft<string, T>>[],
): Normalized<RowsDraft<string, T>> {
  const first = parts[0];
  if (!first) throw new Error("Nothing to merge");
  const warnings: DraftWarning[] = [];
  const confidence: FieldConfidence[] = [];
  const meta: Record<string, RowValue> = {};
  const byIdentity = new Map<string, DraftRow>();
  const taken = new Set<string>();
  for (const part of parts) {
    warnings.push(...part.warnings.filter((w) => !w.path?.startsWith("rows.")));
    for (const [key, value] of Object.entries(part.draft.meta)) {
      if (value === null) continue;
      if (!missing(meta[key]) && meta[key] !== value) {
        warnings.push({
          path: `meta.${key}`,
          message: `The screens disagree on ${spec.meta.find((f) => f.key === key)?.label.toLowerCase() ?? key}; split them into separate sets`,
          severity: "warning",
        });
      } else meta[key] = value;
    }
    const ids = new Map<string, string>();
    for (const row of part.draft.rows) {
      const identity = spec.identity(row);
      const existing = byIdentity.get(identity);
      if (existing) {
        mergeValues(existing, row.values, warnings);
        existing.accepted &&= row.accepted;
        ids.set(row.id, existing.id);
      } else {
        const merged = { ...row, values: { ...row.values }, id: rowId(identity, taken) };
        byIdentity.set(identity, merged);
        ids.set(row.id, merged.id);
      }
    }
    const remap = (path: string) => {
      const [root, id, ...rest] = path.split(".");
      return root === "rows" && id && ids.has(id) ? ["rows", ids.get(id), ...rest].join(".") : path;
    };
    confidence.push(...part.confidence.map((c) => ({ ...c, path: remap(c.path) })));
    warnings.push(
      ...part.warnings
        .filter((w) => w.path?.startsWith("rows."))
        .map((w) => ({ ...w, path: remap(w.path!) })),
    );
  }
  return {
    draft: { target: first.draft.target, meta, rows: [...byIdentity.values()] },
    confidence,
    warnings,
  };
}
