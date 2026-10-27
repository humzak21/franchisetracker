/** The game form's editable state (text inputs hold strings) and its conversion to `GameInput`. */
import { WEEK_KEYS, weekIndex, weekLabel, weekPhase, type WeekKey } from "@shared/domain";
import type { GameInput } from "@shared/games/gameForm";

export type GameFormValue = {
  weekKey: WeekKey;
  bye: boolean;
  opponentTeamId: string;
  userIsHome: boolean;
  neutralSite: boolean;
  us: string;
  them: string;
  overtime: boolean;
  dateLabel: string;
  stadium: string;
  weather: string;
  notes: string;
};

/** What the form submits: a `GameInput` with every field present, plus notes. */
export type GameFormInput = Required<Omit<GameInput<string>, "opponentTeamId">> & {
  opponentTeamId: string | undefined;
  us: number | null;
  them: number | null;
  dateLabel: string;
  stadium: string;
  weather: string;
  notes: string;
};

export type FormTeam = {
  _id: string;
  abbr: string;
  city?: string;
  name?: string;
  conference: string;
  division: string;
};

const PHASE_LABELS = {
  preseason: "Preseason",
  regular: "Regular season",
  postseason: "Playoffs",
  allstar: "Pro Bowl",
} as const;

/** Every week, grouped by phase; playoff weeks are the rounds. */
export const WEEK_OPTIONS = WEEK_KEYS.map((w) => ({
  value: w,
  label: weekLabel(w, "long"),
  group: PHASE_LABELS[weekPhase(w)],
}));

/** Every team but the user's, grouped by division. */
export function opponentOptions(teams: readonly FormTeam[], userTeamId: string) {
  return teams
    .filter((t) => t._id !== userTeamId)
    .map((t) => ({
      value: t._id,
      label: `${t.city ?? ""} ${t.name ?? t.abbr}`.trim(),
      group: `${t.conference} ${t.division}`,
    }));
}

/** The first regular-season (then any) week without a game: where a new game most likely goes. */
export function firstOpenWeek(taken: readonly WeekKey[]): WeekKey {
  const used = new Set(taken);
  const open = WEEK_KEYS.filter((w) => !used.has(w) && w !== "probowl");
  // A season with nothing in it yet starts at week 1, not the preseason.
  const latest = Math.max(weekIndex("w1") - 1, ...taken.filter((w) => w !== "probowl").map(weekIndex));
  return open.find((w) => weekIndex(w) > latest) ?? open[0] ?? "probowl";
}

export function emptyGameForm(weekKey: WeekKey): GameFormValue {
  return {
    weekKey,
    bye: false,
    opponentTeamId: "",
    userIsHome: true,
    neutralSite: false,
    us: "",
    them: "",
    overtime: false,
    dateLabel: "",
    stadium: "",
    weather: "",
    notes: "",
  };
}

const score = (text: string): number | null => (text.trim() === "" ? null : Number(text.trim()));

export function toGameInput(value: GameFormValue): GameFormInput {
  return {
    weekKey: value.weekKey,
    bye: value.bye,
    opponentTeamId: value.opponentTeamId || undefined,
    userIsHome: value.userIsHome,
    neutralSite: value.neutralSite,
    us: score(value.us),
    them: score(value.them),
    overtime: value.overtime,
    dateLabel: value.dateLabel,
    stadium: value.stadium,
    weather: value.weather,
    notes: value.notes,
  };
}
