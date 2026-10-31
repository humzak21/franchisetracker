/**
 * A player's milestones in the order they happened (FEATURES.md 5.4). Marks come from
 * `playerMarks`, which a rebuild or a correction rewrites; the `mark` rows in the feed are only
 * what was announced at the time, so they are left out here.
 */
import { weekIndex, type WeekKey } from "../domain/calendar";
import type { MilestoneKind } from "../domain/milestones";
import { distinctMarks, MARK_HORIZON_LABELS, markLabel, type PlayerMark } from "./marks";

export type TimelineMilestone<G extends string = string> = {
  key: string;
  kind: MilestoneKind;
  title: string;
  year: number;
  weekKey: WeekKey | null;
  gameId: G | null;
};

export type TimelineMark<G extends string = string> = Pick<
  PlayerMark<G>,
  "statKey" | "mark" | "horizon" | "gamesToReach" | "gameId" | "weekKey"
> & {
  year: number;
  /** Where it stands on its fastest-to list; null past the top twenty. */
  rank: number | null;
};

export type TimelineItem<G extends string = string> = TimelineMilestone<G> & { detail: string | null };

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Feed titles lead with the player, which his own page does not need. */
const withoutName = (title: string, name: string) =>
  sentence(title.startsWith(`${name}: `) ? title.slice(name.length + 2) : title);

function markDetail(m: TimelineMark) {
  const games = `in ${m.gamesToReach} game${m.gamesToReach === 1 ? "" : "s"}`;
  const rank = m.rank === null ? "" : ` · #${m.rank} fastest`;
  return `${MARK_HORIZON_LABELS[m.horizon]} · ${games}${rank}`;
}

/** Milestones and marks together, newest first. */
export function playerTimeline<G extends string>(
  name: string,
  milestones: readonly TimelineMilestone<G>[],
  marks: readonly TimelineMark<G>[],
): TimelineItem<G>[] {
  const items: TimelineItem<G>[] = [
    ...milestones
      .filter((m) => m.kind !== "mark")
      .map((m) => ({ ...m, title: withoutName(m.title, name), detail: null })),
    ...distinctMarks(marks).map((m) => ({
      key: `mark:${m.statKey}:${m.mark}:${m.horizon}:${m.gameId}`,
      kind: "mark" as const,
      title: sentence(markLabel(m)),
      year: m.year,
      weekKey: m.weekKey,
      gameId: m.gameId,
      detail: markDetail(m),
    })),
  ];
  const week = (i: TimelineItem<G>) => (i.weekKey ? weekIndex(i.weekKey) : -1);
  return items.sort((a, b) => b.year - a.year || week(b) - week(a));
}
