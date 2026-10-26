import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type PlayerPage = FunctionReturnType<typeof api.players.player.get>;
export type HistoryRow = PlayerPage["history"][number];
