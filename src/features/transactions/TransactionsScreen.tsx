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
import { MovesFeed } from "./MovesFeed";
import { TradesView } from "./TradesView";
import { useQuery } from "@/lib/convex/useQuery";

type View = "moves" | "trades" | "injuries" | "cap";

/** Transactions and injuries (FEATURES.md 5.10): the log, the trade tracker, the injury report and the cap view. */
export function TransactionsScreen() {
  const { season } = useSeason();
  const active = useFranchise();
  const [view, setView] = useLocalStorage<View>("ft.transactions-view", "moves");
  const moves = useQuery(api.transactions.transactions.bySeason, season ? { seasonId: season._id } : "skip");
  const injuries = useQuery(
    api.transactions.transactions.injuries,
    season ? { seasonId: season._id } : "skip",
  );
  const real = season && active ? isPreFranchise(season.year, active.franchise.startYear) : false;

  return (
    <Page title="Transactions" eyebrow={season ? `${season.year} season` : undefined} season>
      <div className="space-y-5">
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
        {!season || moves === undefined || injuries === undefined ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : view === "moves" ? (
          <MovesFeed moves={moves} />
        ) : view === "trades" ? (
          <TradesView moves={moves} />
        ) : view === "injuries" ? (
          <InjuriesView injuries={injuries} />
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
    </Page>
  );
}
