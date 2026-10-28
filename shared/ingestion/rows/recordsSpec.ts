/**
 * A records list from any source (a website, a book, a spreadsheet): the top players in one stat,
 * each with their team, season and number. It fills the team and all-time records books where
 * the data stops (nflverse starts in 1999), committing as typed records.
 */
import { RECORD_BOOK_LABELS, BOARD_BOOKS } from "../../stats/recordBoards";
import { RECORD_SCOPE_LABELS, RECORD_SCOPES, RECORD_STATS } from "../../stats/records";
import { STAT_REGISTRY } from "../../stats/registry";
import { nameKey } from "./engine";
import { ranked } from "./statSpecs";
import type { RowSpec } from "./types";

export const recordsListSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [
    {
      key: "book",
      label: "Book",
      type: "enum",
      required: true,
      hint: "league for an NFL-wide list, team for one franchise's list",
      options: BOARD_BOOKS.map((b) => ({ value: b, label: RECORD_BOOK_LABELS[b] })),
    },
    {
      key: "scope",
      label: "Kind",
      type: "enum",
      required: true,
      hint: "game for single-game records, season for single-season, career for career totals",
      options: RECORD_SCOPES.map((s) => ({ value: s, label: RECORD_SCOPE_LABELS[s] })),
    },
    {
      key: "split",
      label: "Games",
      type: "enum",
      required: true,
      hint: "postseason only for a playoff list, else regular",
      options: [
        { value: "regular", label: "Regular season" },
        { value: "postseason", label: "Playoffs" },
      ],
    },
    {
      key: "stat",
      label: "Stat",
      type: "enum",
      required: true,
      hint: "Which stat the list ranks",
      options: RECORD_STATS.map((k) => ({ value: k, label: STAT_REGISTRY[k].label })),
    },
  ],
  fields: () => [
    { key: "rank", label: "Rank", type: "int", primary: true },
    { key: "value", label: "Number", type: "number", primary: true, required: true },
    {
      key: "year",
      label: "Season",
      type: "int",
      primary: true,
      hint: "The season it was set; for a career, the last season. Null if not shown",
    },
  ],
  // A player can hold two places in a season list (two great years), never two in a career list.
  identity: (row) => `${nameKey(row.name)}|${String(row.values.year ?? "")}`,
  rules: (draft) => ranked(draft, "value", "higher"),
};
