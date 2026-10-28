import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { useQuery } from "@/lib/convex/useQuery";
import { useFranchise } from "../franchise";
import { useSeason } from "../season";
import { MoveEditor } from "./forms/MoveEditor";
import type { Editing } from "./forms/moveForm";
import type { SheetContext } from "./forms/types";
import { useEditor } from "./forms/useEditor";

type MovesState = {
  /** Opens a move or injury sheet: a new one, one started from a player, or a stored one to edit. */
  open: (editing: Editing) => void;
  /** False until the teams load, and before the franchise has a season to record moves in. */
  ready: boolean;
  /** Whether the season on screen is real NFL history, where moves are not recorded. */
  historical: boolean;
};

const MovesContext = createContext<MovesState | null>(null);

/**
 * The trade builder, signing, other move and injury sheets (FEATURES.md 5.10), reachable from any
 * screen: Transactions, the roster, the players list and the player page all open them here.
 */
export function MovesProvider({ children }: { children: ReactNode }) {
  const { season, seasons } = useSeason();
  const active = useFranchise();
  const teams = useQuery(api.league.teams.list, {});
  const editor = useEditor();
  const startYear = active?.franchise.startYear;
  const historical =
    season !== undefined && startYear !== undefined && isPreFranchise(season.year, startYear);

  const context = useMemo<SheetContext | null>(() => {
    if (!active || !teams || startYear === undefined) return null;
    const played = seasons.filter((s) => s.year >= startYear);
    // New moves land in the season on screen, or the latest franchise season when it shows history.
    const target = season && !historical ? season : played.at(-1);
    if (!target) return null;
    return {
      teams,
      // The shown season stays choosable so a move recorded in it can still be edited.
      seasons: seasons.filter((s) => s.year >= startYear || s._id === season?._id),
      seasonId: target._id,
      userTeamId: active.franchise.userTeamId,
    };
  }, [active, teams, startYear, seasons, season, historical]);

  const value = useMemo(
    () => ({ open: editor.openEditor, ready: context !== null, historical }),
    [editor.openEditor, context, historical],
  );
  return (
    <MovesContext.Provider value={value}>
      {children}
      {context && (
        <MoveEditor
          editing={editor.editing}
          session={editor.session}
          open={editor.open}
          onOpenChange={editor.onOpenChange}
          context={context}
        />
      )}
    </MovesContext.Provider>
  );
}

export function useMoves(): MovesState {
  const value = useContext(MovesContext);
  if (!value) throw new Error("useMoves must be used inside MovesProvider");
  return value;
}
