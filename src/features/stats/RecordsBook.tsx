import { useMutation } from "convex/react";
import { Camera, LoaderCircle, Plus, Trophy } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  RECORD_BOOK_LABELS,
  RECORD_BOOKS,
  RECORD_SCOPE_LABELS,
  RECORD_SCOPES,
  RECORD_STATS,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  type RecordBook,
  type RecordScope,
  type StatCategory,
} from "@shared/stats";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { RecordList, type RecordEntry } from "./RecordList";
import { ScoringRecords } from "./ScoringRecords";
import { byRegistryOrder, type Split } from "./split";
import { TypedRecordSheet, type TypedDraft } from "./TypedRecordSheet";

const CATEGORIES = STAT_CATEGORIES.filter((c) => RECORD_STATS.some((s) => STAT_REGISTRY[s].category === c));

function BookNote({ book, startYear }: { book: RecordBook; startYear?: number }) {
  const team = useFranchise()?.userTeam.name ?? "team";
  const text = {
    team: `Every season with the ${team}, real NFL seasons from 1999 included, plus numbers you add.`,
    franchise: `Only what happened since the franchise began${startYear ? ` in ${startYear}` : ""}.`,
    league:
      "Every team: real NFL seasons from 1999, everything captured since, and numbers you add for anyone earlier.",
  }[book];
  return <Notice icon={Trophy}>{text}</Notice>;
}

/** Offers the first build of the team and all-time books, and says while one runs. */
function BuildStatus() {
  const status = useQuery(api.stats.recordBuild.status, {});
  const rebuild = useMutation(api.stats.recordBuild.rebuild);
  if (status === undefined || status?.status === "done") return null;
  if (status?.status === "running") {
    return (
      <Notice icon={LoaderCircle}>
        Building the records books from every season; lists fill in as it goes.
      </Notice>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-3.5 py-2.5 text-sm text-muted-foreground">
      <span className="flex-1">
        The team and all-time books are built once from every season, then kept up after each game.
      </span>
      <Button size="sm" variant="primary" onClick={() => void rebuild({})}>
        Build the books
      </Button>
    </div>
  );
}

/**
 * The records books (FEATURES.md 5.5): the team's (real seasons included), the franchise era's
 * and the all-time league's, each by single game, season and career, top twenty per stat.
 */
export function RecordsBook({ split }: { split: Split }) {
  const [book, setBook] = useLocalStorage<RecordBook>("ft.records-book", "team");
  const [scope, setScope] = useState<RecordScope>("game");
  const [category, setCategory] = useState<StatCategory>("passing");
  const [sheet, setSheet] = useState<{ draft?: TypedDraft } | null>(null);
  const data = useQuery(api.stats.records.lists, { book, split, scope, category });
  const typedBook = book === "franchise" ? null : book;
  const capture = useCapture();

  const edit = (statKey: string) => (e: RecordEntry) =>
    e.typedId &&
    setSheet({
      draft: {
        typedId: e.typedId,
        statKey,
        name: e.name,
        playerId: e.player?.playerId,
        teamAbbr: e.team?.abbr,
        year: e.year ?? undefined,
        value: e.value,
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          aria-label="Book"
          value={book}
          onChange={setBook}
          options={RECORD_BOOKS.map((b) => ({ value: b, label: RECORD_BOOK_LABELS[b] }))}
        />
        <Segmented
          size="sm"
          aria-label="Scope"
          value={scope}
          onChange={setScope}
          options={RECORD_SCOPES.map((s) => ({ value: s, label: RECORD_SCOPE_LABELS[s] }))}
        />
        {typedBook && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSheet({})}>
              <Plus /> Add a record
            </Button>
            <Button size="sm" variant="outline" onClick={() => capture.open({ targetKey: "records_list" })}>
              <Camera /> Capture a list
            </Button>
            <ManualEntryLink target="records_list" label="Type or import a list" />
          </div>
        )}
      </div>
      <div data-swipe-ignore className="-mx-1 scrollbar-none overflow-x-auto px-1">
        <Segmented
          size="sm"
          aria-label="Category"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: STAT_CATEGORY_LABELS[c] }))}
        />
      </div>
      <BookNote book={book} startYear={data?.startYear} />
      {typedBook && <BuildStatus />}
      {data === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.lists.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No records here yet"
          description="Records come from committed box scores and real seasons; add a number by hand for anything earlier."
        />
      ) : (
        <div className="@container grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {[...data.lists].sort(byRegistryOrder).map((list) => (
            <RecordList
              key={list.statKey}
              list={list}
              onEditTyped={typedBook ? edit(list.statKey) : undefined}
            />
          ))}
        </div>
      )}
      <ScoringRecords split={split} />
      {typedBook && sheet && (
        <TypedRecordSheet
          key={sheet.draft?.typedId ?? "new"}
          book={typedBook}
          split={split}
          scope={scope}
          statKey={
            sheet.draft?.statKey ??
            RECORD_STATS.find((s) => STAT_REGISTRY[s].category === category) ??
            "passYds"
          }
          draft={sheet.draft}
          open
          onOpenChange={(open) => !open && setSheet(null)}
        />
      )}
    </div>
  );
}
