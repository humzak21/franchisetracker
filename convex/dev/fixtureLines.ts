/**
 * The sample season's box scores: the user team's player lines per week, by last name. Season
 * totals, records, streaks and milestones are all derived from these, exactly as for real games.
 */
import type { StatLine } from "../../shared/stats";

type Week = "w1" | "w2" | "w3" | "w5" | "w6";

const pass = (cmp: number, att: number, yds: number, td: number, int: number): StatLine => ({
  passCmp: cmp,
  passAtt: att,
  passYds: yds,
  passTd: td,
  passInt: int,
});
const rush = (att: number, yds: number, td = 0): StatLine => ({ rushAtt: att, rushYds: yds, rushTd: td });
const catches = (rec: number, yds: number, td = 0, targets = rec + 2): StatLine => ({
  rec,
  recTargets: targets,
  recYds: yds,
  recTd: td,
});
const defense = (tackles: number, extra: StatLine = {}): StatLine => ({ tackles, ...extra });
const kicks = (fgm: number, fga: number, xpm: number, fgLong: number): StatLine => ({
  fgm,
  fga,
  xpm,
  xpa: xpm,
  fgLong,
});

export const SAMPLE_LINES: Record<Week, Record<string, StatLine>> = {
  w1: {
    Maye: { ...pass(22, 30, 284, 3, 0), ...rush(4, 21) },
    Henderson: { ...rush(18, 88, 1), ...catches(3, 22) },
    Diggs: catches(8, 131, 2, 10),
    Douglas: catches(6, 74, 1),
    Henry: catches(4, 41),
    Spillane: defense(9, { sacks: 1, tacklesForLoss: 2 }),
    Gonzalez: defense(4, { defInt: 1, passDeflections: 2 }),
    Borregales: kicks(1, 1, 4, 44),
  },
  w2: {
    Maye: { ...pass(25, 36, 301, 2, 1), ...rush(3, 12, 1) },
    Henderson: { ...rush(15, 64), ...catches(2, 15) },
    Diggs: catches(9, 112, 1, 12),
    Douglas: catches(7, 88),
    Henry: catches(5, 58, 1),
    Spillane: defense(11, { tacklesForLoss: 1 }),
    Gonzalez: defense(3, { passDeflections: 1 }),
    Borregales: kicks(2, 2, 3, 48),
  },
  w3: {
    Maye: { ...pass(19, 34, 221, 1, 2), ...rush(6, 40) },
    Henderson: { ...rush(20, 97, 1), ...catches(4, 31) },
    Diggs: catches(5, 61, 0, 9),
    Douglas: catches(4, 52, 1),
    Henry: catches(3, 31),
    Spillane: defense(7, { sacks: 0.5 }),
    Gonzalez: defense(5, { passDeflections: 3 }),
    Borregales: kicks(2, 3, 2, 51),
  },
  w5: {
    Maye: { ...pass(27, 38, 342, 3, 0), ...rush(2, 5) },
    Henderson: { ...rush(22, 121, 1), ...catches(1, 8) },
    Diggs: catches(10, 148, 1, 13),
    Douglas: catches(8, 97, 1),
    Henry: catches(6, 89, 1),
    Spillane: defense(12, { sacks: 1, tacklesForLoss: 1 }),
    Gonzalez: defense(2, { defInt: 2, passDeflections: 2 }),
    Borregales: kicks(2, 2, 4, 39),
  },
  w6: {
    Maye: { ...pass(21, 28, 255, 2, 0), ...rush(5, 33, 1) },
    Henderson: { ...rush(19, 108, 2), ...catches(2, 19) },
    Diggs: catches(6, 79, 1, 8),
    Douglas: catches(5, 60),
    Henry: catches(4, 46, 1),
    Spillane: defense(8),
    Gonzalez: defense(3, { defInt: 1, passDeflections: 2 }),
    Borregales: kicks(1, 1, 4, 33),
  },
};
