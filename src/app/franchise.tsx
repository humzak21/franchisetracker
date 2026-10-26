import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, type ReactNode } from "react";
import { api } from "@convex/_generated/api";

export type ActiveFranchise = NonNullable<FunctionReturnType<typeof api.franchise.franchises.getActive>>;
export type Season = ActiveFranchise["seasons"][number];

/** undefined while loading, null when the deployment has not been seeded. */
type FranchiseState = ActiveFranchise | null | undefined;

const FranchiseContext = createContext<FranchiseState>(undefined);

export function FranchiseProvider({ children }: { children: ReactNode }) {
  const active = useQuery(api.franchise.franchises.getActive, {});
  return <FranchiseContext.Provider value={active}>{children}</FranchiseContext.Provider>;
}

export function useFranchise(): FranchiseState {
  return useContext(FranchiseContext);
}

/** The season the franchise is currently playing: the first not yet complete, else the latest. */
export function currentSeason(seasons: readonly Season[]): Season | undefined {
  return seasons.find((s) => s.status !== "complete") ?? seasons[seasons.length - 1];
}
