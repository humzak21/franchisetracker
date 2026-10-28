import { describe, expect, test } from "vitest";
import { emptyRowsDraft } from "../manual";
import { rowsFromCsv } from "./csvRows";
import { recordsListSpec } from "./recordsSpec";
import { leagueLeadersSpec } from "./statSpecs";

const draft = () => emptyRowsDraft("records_list", recordsListSpec, null);

describe("rows from a CSV", () => {
  test("columns match by key, label or a common heading, with numbers cleaned up", () => {
    const csv =
      '\uFEFFRk,Player,Tm,Season,Number\n1,Bruce Smith,BUF,2003,200\n2,"White, Reggie",phi,2000,"1,98"\n\n';
    const { rows, ignored } = rowsFromCsv(csv, recordsListSpec, draft());
    expect(ignored).toEqual([]);
    expect(
      rows.map((r) => [r.name, r.teamAbbr, r.values.rank, r.values.year, r.values.value, r.accepted]),
    ).toEqual([
      ["Bruce Smith", "BUF", 1, 2003, 200, true],
      ["White, Reggie", "PHI", 2, 2000, 198, true],
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });

  test("an old team abbreviation resolves to today's team; unknown columns are reported", () => {
    const { rows, ignored } = rowsFromCsv(
      "player,team,year,value,notes\nDan Fouts,SDG,1987,43040,HOF\n",
      recordsListSpec,
      draft(),
    );
    expect(rows[0]).toMatchObject({ teamAbbr: "LAC", values: { year: 1987, value: 43040 } });
    expect(ignored).toEqual(["notes"]);
  });

  test("works for any list target", () => {
    const leaders = emptyRowsDraft("league_leaders", leagueLeadersSpec, null);
    const { rows } = rowsFromCsv("rank,name,team,value\n1,J. Allen,BUF,1620\n", leagueLeadersSpec, leaders);
    expect(rows[0]).toMatchObject({ name: "J. Allen", values: { rank: 1, value: 1620 } });
  });

  test("an empty file gives no rows", () => {
    expect(rowsFromCsv("", recordsListSpec, draft())).toEqual({ rows: [], ignored: [] });
  });
});
