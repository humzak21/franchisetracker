import { useSeason } from "@/app/season";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { Page } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/misc";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { BoardView } from "./BoardView";
import { ClassesView } from "./ClassesView";
import { DraftClassView } from "./DraftClassView";
import { InventoryView } from "./InventoryView";

type View = "draft" | "classes" | "picks" | "board";

const VIEWS: { value: View; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "classes", label: "Classes" },
  { value: "picks", label: "Picks" },
  { value: "board", label: "Board" },
];

/** Draft (FEATURES.md 5.9): a season's draft, every class graded in hindsight, the pick inventory, the board. */
export function DraftScreen() {
  const { season, setYear } = useSeason();
  const [view, setView] = useLocalStorage<View>("ft.draft-view", "draft");
  const seasonal = view === "draft" || view === "board";
  return (
    <Page
      title="Draft"
      eyebrow={seasonal && season ? `${season.year} draft` : undefined}
      season={seasonal}
      actions={
        view === "draft" && season ? (
          <ManualEntryLink target="draft_results" seasonId={season._id} label="Add picks" />
        ) : undefined
      }
    >
      <div className="space-y-5">
        <Segmented aria-label="View" value={view} onChange={setView} options={VIEWS} />
        {seasonal && !season && <Skeleton className="h-64 rounded-xl" />}
        {view === "draft" && season && <DraftClassView seasonId={season._id} />}
        {view === "board" && season && <BoardView year={season.year} />}
        {view === "classes" && (
          <ClassesView
            onOpen={(year) => {
              setYear(year);
              setView("draft");
            }}
          />
        )}
        {view === "picks" && <InventoryView />}
      </div>
    </Page>
  );
}
