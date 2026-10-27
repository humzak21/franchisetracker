import { Wallet } from "lucide-react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/misc";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { CapView } from "./CapView";
import { InjuriesView } from "./InjuriesView";
import { MoveActions } from "./MoveActions";
import { MovesFeed } from "./MovesFeed";
import { TradesView } from "./TradesView";
import { MoveEditor } from "./forms/MoveEditor";
import { editingMove } from "./forms/moveForm";
import { useEditor } from "./forms/useEditor";
import type { Move } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

type View = "moves" | "trades" | "injuries" | "cap";

/**
 * Transactions and injuries (FEATURES.md 5.10): the log, the trade tracker, the injury report and
 * the cap view, with sheets to record, edit and delete trades, signings, other moves and injuries.
 */
export function TransactionsScreen() {
  const { season, seasons } = useSeason();
  const active = useFranchise();
  const [view, setView] = useLocalStorage<View>("ft.transactions-view", "moves");
  const moves = useQuery(api.transactions.transactions.bySeason, season ? { seasonId: season._id } : "skip");
  const injuries = useQuery(
    api.transactions.transactions.injuries,
    season ? { seasonId: season._id } : "skip",
  );
  const teams = useQuery(api.league.teams.list, {});
  const editor = useEditor();
  const startYear = active?.franchise.startYear;
  const real = season && startYear !== undefined ? isPreFranchise(season.year, startYear) : false;
  const context =
    season && active && teams
      ? {
          teams,
          // Moves are recorded in franchise seasons; the shown season stays choosable for edits.
          seasons: seasons.filter((s) => s.year >= active.franchise.startYear || s._id === season._id),
          seasonId: season._id,
          userTeamId: active.franchise.userTeamId,
        }
      : null;
  const editMove = (move: Move) => editor.openEditor(editingMove(move));

  return (
    <Page title="Transactions" eyebrow={season ? `${season.year} season` : undefined} season>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            aria-label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "moves", label: "Moves", count: moves?.length },
              { value: "trades", label: "Trades", count: moves?.filter((m) => m.type === "trade").length },
              { value: "injuries", label: "Injuries", count: injuries?.length },
              { value: "cap", label: "Cap" },
            ]}
          />
          {context && !real && view !== "cap" && (
            <MoveActions injuries={view === "injuries"} onOpen={editor.openEditor} />
          )}
        </div>
        {!season || moves === undefined || injuries === undefined ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : view === "moves" ? (
          <MovesFeed moves={moves} onEdit={editMove} />
        ) : view === "trades" ? (
          <TradesView moves={moves} onEdit={editMove} />
        ) : view === "injuries" ? (
          <InjuriesView
            injuries={injuries}
            onEdit={(injury) => editor.openEditor({ kind: "injury", injury })}
          />
        ) : real ? (
          <EmptyState
            icon={Wallet}
            title="No cap for real seasons"
            description="The cap view covers the seasons you play in the franchise."
          />
        ) : (
          <CapView seasonId={season._id} />
        )}
      </div>
      {context && (
        <MoveEditor
          editing={editor.editing}
          session={editor.session}
          open={editor.open}
          onOpenChange={editor.onOpenChange}
          context={context}
        />
      )}
    </Page>
  );
}
