import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type Overview = FunctionReturnType<typeof api.league.standings.overview>;
export type Board = NonNullable<FunctionReturnType<typeof api.league.board.season>>;
export type BoardRow = Board["rows"][number];
