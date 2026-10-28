import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type SeasonAward = FunctionReturnType<typeof api.awards.awards.bySeason>[number];

/** What an award card shows: a stored winner, or a winner counted from the stats. */
export type AwardWinner = Pick<SeasonAward, "type" | "name" | "player" | "team" | "statLine" | "isUser"> & {
  customName?: string;
};

export type CountedAward = FunctionReturnType<typeof api.awards.counted.bySeason>[number];
