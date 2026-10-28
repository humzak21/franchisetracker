import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { SeasonStatus } from "@shared/domain";

export type FormTeam = FunctionReturnType<typeof api.league.teams.list>[number];

/** What every move sheet needs from the screen: the teams, the seasons and whose franchise it is. */
export type SheetContext = {
  teams: readonly FormTeam[];
  seasons: readonly { _id: Id<"seasons">; year: number; status: SeasonStatus }[];
  /** The season the screen is showing; new moves default to it. */
  seasonId: Id<"seasons">;
  userTeamId: Id<"teams">;
};
