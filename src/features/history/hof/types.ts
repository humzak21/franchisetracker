import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type WallEntry = FunctionReturnType<typeof api.hof.entries.wall>[number];

/** The name across the back of the jersey: the last name, or the whole name when there is one word. */
export function jerseyName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}
