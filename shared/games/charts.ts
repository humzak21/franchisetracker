/** Week points shaped for the season charts (`DivergingBars`, `PointsChart`). */
import { weekIndex, weekLabel, type WeekKey } from "../domain/calendar";
import { streakLabel, type WeekPoint } from "./insights";

/** A week point, with the opponent's abbreviation when known (it labels the tooltip). */
export type ChartWeek = WeekPoint & { opponentAbbr?: string | null };

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function labels(point: ChartWeek) {
  return {
    key: point.weekKey,
    short: weekLabel(point.weekKey),
    label: `${weekLabel(point.weekKey, "long")}${point.opponentAbbr ? ` vs ${point.opponentAbbr}` : ""}`,
  };
}

export function marginBars(points: readonly ChartWeek[]) {
  return points.map((p) => ({
    ...labels(p),
    value: p.margin,
    display: `${signed(p.margin)} (${p.pointsFor}-${p.pointsAgainst})`,
  }));
}

export function streakBars(points: readonly ChartWeek[]) {
  return points.map((p) => ({ ...labels(p), value: p.streak, display: streakLabel(p.streak) }));
}

export function pointsWeeks(points: readonly ChartWeek[]) {
  return points.map((p) => ({ ...labels(p), pointsFor: p.pointsFor, pointsAgainst: p.pointsAgainst }));
}

export type Meeting = { id: string; year: number; weekKey: WeekKey; us: number; them: number };

/** Every meeting with one opponent as margin bars, oldest first ("'26 W3"). */
export function meetingBars(meetings: readonly Meeting[]) {
  return [...meetings]
    .sort((a, b) => a.year - b.year || weekIndex(a.weekKey) - weekIndex(b.weekKey))
    .map((m) => ({
      key: m.id,
      short: `'${String(m.year).slice(2)} ${weekLabel(m.weekKey)}`,
      label: `${m.year} ${weekLabel(m.weekKey, "long")}`,
      value: m.us - m.them,
      display: `${signed(m.us - m.them)} (${m.us}-${m.them})`,
    }));
}
