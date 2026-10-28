import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type Move = FunctionReturnType<typeof api.transactions.transactions.bySeason>[number];
export type Injury = FunctionReturnType<typeof api.transactions.transactions.injuries>[number];
