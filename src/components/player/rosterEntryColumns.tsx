import {
  ACQUISITION_LABELS,
  ACQUISITION_TYPES,
  DEV_TRAIT_LABELS,
  DEV_TRAITS,
  POSITIONS,
  ROSTER_STATUS_LABELS,
  ROSTER_STATUSES,
  WEEK_KEYS,
  sideOf,
  weekLabel,
  type AcquisitionType,
  type DevTrait,
  type Position,
  type RosterStatus,
  type WeekKey,
} from "@shared/domain";
import { positionOrder } from "@shared/players/format";
import { formatMoney } from "@shared/roster/cap";
import { APY_UNIT } from "@shared/roster/entryCell";
import type { DataColumn } from "@/components/data/DataTable";
import { PositionBadge } from "./PositionBadge";

/** The roster entry fields these columns show and edit. */
export type EntryLike = {
  jersey?: number;
  position: Position;
  ovr?: number;
  devTrait?: DevTrait;
  abilities?: string[];
  age?: number;
  exp?: number;
  status: RosterStatus;
  statusWeekKey?: WeekKey;
  acquisition?: { type: AcquisitionType; year?: number; detail?: string };
  contract?: { years?: number; apy?: number; expiresYear?: number };
  gradeNote?: string;
};

const SIDE_LABELS = { offense: "Offense", defense: "Defense", special: "Special teams" } as const;
const options = <T extends string>(values: readonly T[], label: (v: T) => string) =>
  values.map((value) => ({ value, label: label(value) }));
const muted = (text: string | undefined) =>
  text ? (
    <span className="block max-w-80 truncate text-muted-foreground" title={text}>
      {text}
    </span>
  ) : (
    <span className="text-subtle-foreground">—</span>
  );

/**
 * Columns for a season's roster entry, keyed by the entry patch field they edit
 * (`shared/roster/entryCell.ts`), so the roster and a player's roster history pick the same ones.
 * `ageOf` supplies an age derived from the player's birth year when the entry has none.
 */
export function rosterEntryColumns<T>(
  entryOf: (row: T) => EntryLike,
  ageOf: (row: T) => number | null = (row) => entryOf(row).age ?? null,
) {
  const e = entryOf;
  const whole = (
    id: string,
    header: string,
    title: string,
    get: (x: EntryLike) => number | undefined,
    max: number,
    min = 0,
  ): DataColumn<T> => ({
    id,
    header,
    title,
    align: "right",
    value: (r) => get(e(r)),
    edit: { kind: "number", get: (r) => get(e(r)), min, max },
  });
  return {
    position: {
      id: "position",
      header: "Pos",
      title: "Position",
      value: (r) => positionOrder(e(r).position),
      cell: (r) => <PositionBadge position={e(r).position} />,
      edit: {
        kind: "select",
        get: (r) => e(r).position,
        options: POSITIONS.map((p) => ({ value: p, label: p, group: SIDE_LABELS[sideOf(p)] })),
      },
    },
    jersey: whole("jersey", "#", "Jersey", (x) => x.jersey, 99),
    age: {
      ...whole("age", "Age", "Age", (x) => x.age, 60, 15),
      value: ageOf,
      edit: { kind: "number", get: ageOf, min: 15, max: 60 },
    },
    ovr: {
      ...whole("ovr", "OVR", "Overall rating", (x) => x.ovr, 99),
      sortDescFirst: true,
      cell: (r) => <span className="num font-semibold">{e(r).ovr ?? "—"}</span>,
    },
    devTrait: {
      id: "devTrait",
      header: "Dev",
      title: "Dev trait",
      value: (r) => {
        const trait = e(r).devTrait;
        return trait ? DEV_TRAIT_LABELS[trait] : null;
      },
      edit: {
        kind: "select",
        get: (r) => e(r).devTrait,
        options: options(DEV_TRAITS, (t) => DEV_TRAIT_LABELS[t]),
      },
    },
    exp: whole("exp", "Exp", "Years of experience", (x) => x.exp, 30),
    status: {
      id: "status",
      header: "Status",
      value: (r) => ROSTER_STATUS_LABELS[e(r).status],
      cell: (r) => {
        const status = e(r).status;
        return (
          <span className={status === "active" ? "text-muted-foreground" : "font-medium"}>
            {ROSTER_STATUS_LABELS[status]}
          </span>
        );
      },
      edit: {
        kind: "select",
        get: (r) => e(r).status,
        options: options(ROSTER_STATUSES, (s) => ROSTER_STATUS_LABELS[s]),
      },
    },
    statusWeekKey: {
      id: "statusWeekKey",
      header: "Since",
      title: "Week the status took effect",
      value: (r) => {
        const week = e(r).statusWeekKey;
        return week ? weekLabel(week) : null;
      },
      edit: {
        kind: "select",
        get: (r) => e(r).statusWeekKey,
        options: options(WEEK_KEYS, (w) => weekLabel(w, "long")),
      },
    },
    acquisitionType: {
      id: "acquisitionType",
      header: "Acquired",
      title: "How he was acquired",
      value: (r) => {
        const type = e(r).acquisition?.type;
        return type ? ACQUISITION_LABELS[type] : null;
      },
      edit: {
        kind: "select",
        get: (r) => e(r).acquisition?.type,
        options: options(ACQUISITION_TYPES, (t) => ACQUISITION_LABELS[t]),
      },
    },
    acquisitionYear: whole(
      "acquisitionYear",
      "Year",
      "Year acquired",
      (x) => x.acquisition?.year,
      2200,
      1920,
    ),
    acquisitionDetail: {
      id: "acquisitionDetail",
      header: "How",
      title: "Acquisition detail",
      sortable: false,
      value: (r) => e(r).acquisition?.detail,
      cell: (r) => muted(e(r).acquisition?.detail),
      edit: { kind: "text", get: (r) => e(r).acquisition?.detail, placeholder: "Rd 1, #12" },
    },
    contractYears: whole("contractYears", "Yrs", "Contract years", (x) => x.contract?.years, 10),
    contractApy: {
      id: "contractApy",
      header: "APY",
      title: "Average per year ($M)",
      align: "right",
      sortDescFirst: true,
      value: (r) => e(r).contract?.apy,
      cell: (r) => {
        const apy = e(r).contract?.apy;
        return apy === undefined ? <span className="text-subtle-foreground">—</span> : formatMoney(apy);
      },
      edit: {
        kind: "number",
        get: (r) => {
          const apy = e(r).contract?.apy;
          return apy === undefined ? null : apy / APY_UNIT;
        },
        min: 0,
        max: 1000,
        step: 0.1,
      },
    },
    contractExpiresYear: whole(
      "contractExpiresYear",
      "Expires",
      "Contract expires",
      (x) => x.contract?.expiresYear,
      2200,
      1920,
    ),
    abilities: {
      id: "abilities",
      header: "Abilities",
      sortable: false,
      value: (r) => e(r).abilities?.join(", "),
      cell: (r) => muted(e(r).abilities?.join(", ")),
      edit: { kind: "text", get: (r) => e(r).abilities?.join(", "), placeholder: "Comma separated" },
    },
    gradeNote: {
      id: "gradeNote",
      header: "Grade note",
      sortable: false,
      value: (r) => e(r).gradeNote,
      cell: (r) => muted(e(r).gradeNote),
      edit: { kind: "text", get: (r) => e(r).gradeNote, placeholder: "Note" },
    },
  } satisfies Record<string, DataColumn<T>>;
}
