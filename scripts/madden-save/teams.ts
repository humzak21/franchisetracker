/** The save's Team table: the 32 clubs, keyed every way the other tables point at them. */
import { resolveTeamAbbr } from "../../shared/domain/teams";
import { num, str, type Row, type SaveFile } from "./saveFile";
import type { ExportTeam } from "./types";

export type MaddenTeam = ExportTeam & {
  /** Position in the Team table, which references point at. */
  rowIndex: number;
  /** `TEAM_ORIGID`, what a player's draft team column holds. */
  origId: number;
  row: Row;
};

export class Teams {
  private readonly byRow = new Map<number, MaddenTeam>();
  private readonly byIndex = new Map<number, MaddenTeam>();
  private readonly byOrigId = new Map<number, MaddenTeam>();

  constructor(readonly all: MaddenTeam[]) {
    for (const team of all) {
      this.byRow.set(team.rowIndex, team);
      this.byIndex.set(team.maddenIndex, team);
      this.byOrigId.set(team.origId, team);
    }
  }

  static async read(save: SaveFile): Promise<Teams> {
    const teams: MaddenTeam[] = [];
    for (const { index, row } of await save.rows("Team")) {
      const maddenIndex = num(row, "TeamIndex");
      // Pro Bowl squads, the free-agent pool and the practice team share index 32.
      if (maddenIndex >= 32) continue;
      const city = str(row, "LongName");
      const name = str(row, "DisplayName");
      const abbr = resolveTeamAbbr(`${city} ${name}`) ?? resolveTeamAbbr(str(row, "ShortName"));
      if (!abbr) continue;
      teams.push({ abbr, city, name, maddenIndex, rowIndex: index, origId: num(row, "TEAM_ORIGID"), row });
    }
    return new Teams(teams.sort((a, b) => a.abbr.localeCompare(b.abbr)));
  }

  /** The team a reference into the Team table names. */
  ofRef(save: SaveFile, value: unknown): MaddenTeam | null {
    const index = save.refIndex(value);
    return index === null ? null : (this.byRow.get(index) ?? null);
  }

  ofIndex(maddenIndex: number): MaddenTeam | null {
    return this.byIndex.get(maddenIndex) ?? null;
  }

  ofOrigId(origId: number): MaddenTeam | null {
    return this.byOrigId.get(origId) ?? null;
  }

  get exported(): ExportTeam[] {
    return this.all.map(({ abbr, city, name, maddenIndex }) => ({ abbr, city, name, maddenIndex }));
  }
}
