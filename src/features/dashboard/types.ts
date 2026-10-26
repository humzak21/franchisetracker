import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type HomeSeason = NonNullable<FunctionReturnType<typeof api.dashboard.home.season>>;
export type DashboardGame = NonNullable<HomeSeason["lastGame"]>;
export type NextGame = NonNullable<HomeSeason["nextGame"]>;
