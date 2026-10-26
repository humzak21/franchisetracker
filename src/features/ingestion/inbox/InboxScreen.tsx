import { useMutation, useQuery } from "convex/react";
import { CheckSquare, Inbox, Tag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useShortcut } from "@/app/keyboard";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { SetCard } from "./SetCard";
import { TagSheet } from "./TagSheet";
import { filterOf, type InboxFilter } from "./status";

const gridClass = "grid grid-cols-2 gap-3 @tablet:grid-cols-3 @desktop:grid-cols-4 @desktop:gap-4";

/** The ingestion queue (FEATURES.md 5.11): every screenshot set, its tags and status, with batch actions. */
export function InboxScreen() {
  const sets = useQuery(api.ingestion.inbox.list, {});
  const reject = useMutation(api.ingestion.uploads.reject);
  const remove = useMutation(api.ingestion.uploads.remove);
  const { open: openCapture, queued } = useCapture();
  const [filter, setFilter] = useState<InboxFilter>("todo");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagging, setTagging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visible = useMemo(() => (sets ?? []).filter((s) => filterOf(s.status) === filter), [sets, filter]);
  const counts = useMemo(() => {
    const todo = (sets ?? []).filter((s) => filterOf(s.status) === "todo").length;
    return { todo, done: (sets?.length ?? 0) - todo };
  }, [sets]);
  const chosen = visible.filter((s) => selected.has(s.setKey));

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmDelete(false);
  };
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useShortcut("inbox-select-all", {
    key: "a",
    mod: true,
    label: "Select every set in the inbox",
    handler: () => {
      setSelecting(true);
      setSelected(new Set(visible.map((s) => s.setKey)));
    },
  });
  useShortcut("inbox-clear", { key: "escape", label: "Clear the inbox selection", handler: stopSelecting });

  return (
    <Page
      title="Inbox"
      actions={
        sets && sets.length > 0 ? (
          <Button
            variant={selecting ? "secondary" : "ghost"}
            size="sm"
            onClick={selecting ? stopSelecting : () => setSelecting(true)}
          >
            {selecting ? <X /> : <CheckSquare />} {selecting ? "Done" : "Select"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={filter}
            onChange={setFilter}
            aria-label="Show"
            options={[
              { value: "todo", label: "To do", count: counts.todo },
              { value: "done", label: "Done", count: counts.done },
            ]}
          />
          {queued > 0 && (
            <span className="text-sm text-warn">
              {queued} capture{queued === 1 ? "" : "s"} waiting for a connection
            </span>
          )}
        </div>

        {sets === undefined ? (
          <div className={gridClass}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3.9] rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            size="page"
            icon={Inbox}
            title={filter === "todo" ? "Inbox zero" : "Nothing committed yet"}
            description={
              filter === "todo"
                ? "Snap the box score after a game. Screenshots land here, get read, and wait for your review."
                : "Committed and rejected screenshots show up here."
            }
            action={
              <Button variant="primary" onClick={() => openCapture()}>
                Capture screenshots
              </Button>
            }
          />
        ) : (
          <ul className={gridClass} aria-label="Screenshot sets">
            {visible.map((set) => (
              <li key={set.setKey}>
                <SetCard
                  set={set}
                  selecting={selecting}
                  selected={selected.has(set.setKey)}
                  onToggle={() => toggle(set.setKey)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {selecting && chosen.length > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-40 mx-auto w-[min(100%-2rem,36rem)] sm:bottom-6">
          <div className="shadow-elevated flex items-center gap-2 rounded-2xl border border-border-strong bg-surface p-2">
            <span className="num flex-1 px-2 text-sm font-medium">{chosen.length} selected</span>
            <Button size="sm" variant="primary" onClick={() => setTagging(true)}>
              <Tag /> Tag
            </Button>
            <Button
              size="sm"
              onClick={() => void reject({ setKeys: chosen.map((s) => s.setKey) }).then(stopSelecting)}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant={confirmDelete ? "destructive" : "ghost"}
              aria-label={confirmDelete ? "Confirm delete" : "Delete"}
              onClick={() =>
                confirmDelete
                  ? void remove({ setKeys: chosen.map((s) => s.setKey) }).then(stopSelecting)
                  : setConfirmDelete(true)
              }
            >
              <Trash2 /> {confirmDelete && "Delete"}
            </Button>
          </div>
        </div>
      )}
      {tagging && (
        <TagSheet
          setKeys={chosen.map((s) => s.setKey)}
          images={chosen.reduce((n, s) => n + s.images.length, 0)}
          defaults={{ seasonId: chosen[0]?.seasonId ?? null, weekKey: chosen[0]?.weekKey ?? null }}
          open={tagging}
          onOpenChange={setTagging}
          onDone={() => {
            setTagging(false);
            stopSelecting();
          }}
        />
      )}
    </Page>
  );
}
