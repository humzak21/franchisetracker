/** The league team stats screen as a row target: every team's season numbers, one tab per array. */
import { LEAGUE_TEAM_RAW, LEAGUE_TEAM_RAW_KEYS, type LeagueTeamRawKey } from "../../stats/leagueTeamRegistry";
import { LEAGUE_TEAM_SCREEN_TABS, rawKeysInTab } from "../../stats/leagueTeamTabs";
import { extractionField } from "../../stats/registry";
import { rows as rowList, type Obj } from "../normalize";
import { nullable, object, rowMeta } from "../schema";
import type { DraftWarning } from "../types";
import { fieldSchema } from "./engine";
import type { RowField, RowSpec } from "./types";

const field = (key: LeagueTeamRawKey): RowField => ({
  key,
  label: LEAGUE_TEAM_RAW[key].label,
  type: LEAGUE_TEAM_RAW[key].format === "int" ? "int" : "number",
  hint: LEAGUE_TEAM_RAW[key].hint,
});

const ALL_FIELDS = LEAGUE_TEAM_RAW_KEYS.map(field);
/** On the row card without expanding it: the first numbers of each tab. */
const PRIMARY = new Set<string>(LEAGUE_TEAM_SCREEN_TABS.flatMap((tab) => rawKeysInTab(tab).slice(0, 3)));

/** Made never exceeds attempted: a misread digit usually breaks this first. */
const PAIRS: readonly [made: LeagueTeamRawKey, att: LeagueTeamRawKey][] = [
  ["thirdDownConv", "thirdDownAtt"],
  ["fourthDownConv", "fourthDownAtt"],
  ["twoPtConv", "twoPtAtt"],
  ["redZoneTd", "redZoneAtt"],
  ["redZoneDefTd", "redZoneDefAtt"],
];

export const leagueTeamStatsSpec: RowSpec = {
  player: false,
  rowTeam: true,
  meta: [],
  fields: (draft) => {
    const present = new Set(draft?.rows.flatMap((r) => Object.keys(r.values)) ?? []);
    const fields = draft ? ALL_FIELDS.filter((f) => present.has(f.key)) : ALL_FIELDS;
    return fields.map((f) => ({ ...f, primary: PRIMARY.has(f.key) }));
  },
  identity: (row) => row.teamAbbr ?? "?",
  rowsSchema: () =>
    Object.fromEntries(
      LEAGUE_TEAM_SCREEN_TABS.map((tab) => {
        const row = object({
          team: nullable("string", "The team as printed (Bengals)."),
          ...Object.fromEntries(rawKeysInTab(tab).map((k) => [extractionField(k), fieldSchema(field(k))])),
          ...rowMeta,
        });
        return [tab, { type: "array", items: row }];
      }),
    ),
  readRows: (raw: Obj) => LEAGUE_TEAM_SCREEN_TABS.flatMap((tab) => rowList(raw[tab])),
  rules: (draft) =>
    draft.rows.flatMap((r) => {
      if (!r.accepted) return [];
      const out: DraftWarning[] = [];
      for (const [made, att] of PAIRS) {
        const m = r.values[made];
        const a = r.values[att];
        if (typeof m === "number" && typeof a === "number" && m > a) {
          out.push({
            path: `rows.${r.id}.values.${made}`,
            message: `${r.teamAbbr ?? "A team"}: ${LEAGUE_TEAM_RAW[made].label.toLowerCase()} is more than the attempts`,
            severity: "warning",
          });
        }
      }
      const { redZoneTd, redZoneFg, redZoneAtt } = r.values;
      if (
        typeof redZoneTd === "number" &&
        typeof redZoneFg === "number" &&
        typeof redZoneAtt === "number" &&
        redZoneTd + redZoneFg > redZoneAtt
      ) {
        out.push({
          path: `rows.${r.id}.values.redZoneAtt`,
          message: `${r.teamAbbr ?? "A team"}: more red zone scores than trips`,
          severity: "warning",
        });
      }
      return out;
    }),
};
