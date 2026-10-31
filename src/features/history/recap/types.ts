import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type Recap = NonNullable<FunctionReturnType<typeof api.seasons.recap.get>>;
