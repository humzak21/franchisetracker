import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type SeasonAward = FunctionReturnType<typeof api.awards.awards.bySeason>[number];
