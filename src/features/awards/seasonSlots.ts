/** The season view's slots with their winners: stored, else counted from the stats. Pure. */
import { countedWinners, isCountedAward, COUNTED_AWARDS } from "@shared/awards/counted";
import { conferenceSlots, LEAGUE_AWARDS, leagueSlots, splitFilled, type Slot } from "@shared/awards/groups";
import type { AwardType } from "@shared/domain";
import type { AwardWinner, CountedAward, SeasonAward } from "./types";

export type ResolvedSlot = Slot<AwardWinner> & {
  /** A winner is stored, so it can be cleared; counted winners are not. */
  assigned: boolean;
};

export function seasonBoard(awards: readonly SeasonAward[], counted: readonly CountedAward[] | undefined) {
  const contenders = (type: AwardType) => counted?.find((c) => c.type === type)?.contenders ?? [];
  const resolve = (slot: Slot<SeasonAward>): ResolvedSlot => ({
    ...slot,
    assigned: slot.winners.length > 0,
    winners:
      slot.winners.length > 0 || !isCountedAward(slot.type)
        ? slot.winners
        : countedWinners(contenders(slot.type)).map((c) => ({ ...c, type: slot.type })),
  });
  const { conferences, unplaced } = conferenceSlots(awards);
  return {
    league: splitFilled(leagueSlots(awards, LEAGUE_AWARDS).map(resolve)),
    conferences: conferences.map((c) => ({ conference: c.conference, ...splitFilled(c.slots.map(resolve)) })),
    unplaced,
    stats: splitFilled(leagueSlots(awards, COUNTED_AWARDS).map(resolve)),
    contenders,
  };
}
