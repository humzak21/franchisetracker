import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { forgetQueryCacheScope, setQueryCacheScope, useQuery } from "@/lib/convex/useQuery";

export type ActiveFranchise = NonNullable<FunctionReturnType<typeof api.franchise.franchises.getActive>>;
export type Season = ActiveFranchise["seasons"][number];

/** undefined while loading, null when the deployment has not been seeded. */
type FranchiseState = ActiveFranchise | null | undefined;

const FranchiseContext = createContext<FranchiseState>(undefined);

export function FranchiseProvider({ children }: { children: ReactNode }) {
  const active = useQuery(api.franchise.franchises.getActive, {});
  // Set during render, before any screen's query builds its cache key.
  if (active) setQueryCacheScope(active.franchise._id);
  return <FranchiseContext.Provider value={active}>{children}</FranchiseContext.Provider>;
}

export function useFranchise(): FranchiseState {
  return useContext(FranchiseContext);
}

/** The season the franchise is currently playing: the first not yet complete, else the latest. */
export function currentSeason(seasons: readonly Season[]): Season | undefined {
  return seasons.find((s) => s.status !== "complete") ?? seasons[seasons.length - 1];
}

/**
 * Makes another franchise the active one and goes Home: whatever screen was open (a game, a
 * player) belongs to the franchise being left. Needs the router, so only screens call it.
 */
export function useSwitchFranchise(): (franchiseId: Id<"franchises">) => Promise<void> {
  const activate = useMutation(api.franchise.franchises.activate);
  const navigate = useNavigate();
  return useCallback(
    async (franchiseId) => {
      await activate({ franchiseId });
      await navigate({ to: "/" });
      // Already on Home, the navigation is a no-op; the new franchise still starts at the top.
      window.scrollTo({ top: 0 });
    },
    [activate, navigate],
  );
}

/**
 * Deletes a franchise once its name is typed. The deleted franchise's cached screens are
 * forgotten; deleting the active one goes Home, where the franchise taking over (or first-run
 * setup, when none is left) appears.
 */
export function useDeleteFranchise(): (franchiseId: Id<"franchises">, confirmName: string) => Promise<void> {
  const remove = useMutation(api.franchise.remove.remove);
  const active = useFranchise();
  const navigate = useNavigate();
  const activeId = active?.franchise._id;
  return useCallback(
    async (franchiseId, confirmName) => {
      await remove({ franchiseId, confirmName });
      forgetQueryCacheScope(franchiseId);
      if (franchiseId !== activeId) return;
      await navigate({ to: "/" });
      window.scrollTo({ top: 0 });
    },
    [remove, activeId, navigate],
  );
}
