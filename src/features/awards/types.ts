import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { AwardType, Conference } from "@shared/domain";

export type SeasonAward = FunctionReturnType<typeof api.awards.awards.bySeason>[number];

/** What an award card shows: a stored winner, or a winner counted from the stats. */
export type AwardWinner = Pick<SeasonAward, "type" | "name" | "player" | "team" | "statLine" | "isUser"> & {
  customName?: string;
};

export type CountedAward = FunctionReturnType<typeof api.awards.counted.bySeason>[number];

/** The award slot being assigned: the award, and the conference for the per-conference awards. */
export type SlotKey = { type: AwardType; conference?: Conference };
