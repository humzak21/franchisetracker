import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArchiveRestore, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Badge, Skeleton } from "@/components/ui/misc";
import { formatAge } from "@/lib/time";

type Backup = FunctionReturnType<typeof api.ops.backupData.list>[number];

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(bytes < 1_000_000 ? 2 : 1)} MB`;
const dated = (at: number) =>
  new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Backups newest first, each downloadable, restorable as new franchises, or deletable. */
export function BackupList({ onRestore, busy }: { onRestore: (backup: Backup) => void; busy: boolean }) {
  const backups = useQuery(api.ops.backupData.list, {});
  const remove = useMutation(api.ops.backupData.remove);
  const [confirming, setConfirming] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState<Id<"backups"> | null>(null);

  if (backups === undefined) return <Skeleton className="h-24 rounded-xl" />;
  if (backups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No backups yet. One is taken every night; take one now to start.
      </p>
    );
  }
  return (
    <>
      <ul aria-label="Backups" className="divide-y divide-border rounded-xl border border-border bg-surface">
        {backups.map((b) => (
          <li key={b._id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {dated(b.createdAt)}
                <Badge tone={b.kind === "manual" ? "accent" : "neutral"}>{b.kind}</Badge>
              </div>
              <div className="num truncate text-xs text-muted-foreground">
                {b.franchises.join(", ")} · {b.rows.toLocaleString()} rows · {megabytes(b.bytes)} ·{" "}
                {formatAge(b.createdAt)}
              </div>
            </div>
            <div className="flex gap-1">
              {b.url && (
                <Button
                  asChild
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Download backup from ${dated(b.createdAt)}`}
                >
                  <a href={b.url} download>
                    <Download />
                  </a>
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={busy || !b.url}
                aria-label={`Restore backup from ${dated(b.createdAt)}`}
                onClick={() => setConfirming(b)}
              >
                <ArchiveRestore />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={deleting === b._id}
                aria-label={`Delete backup from ${dated(b.createdAt)}`}
                onClick={() => {
                  setDeleting(b._id);
                  remove({ backupId: b._id }).finally(() => setDeleting(null));
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent
          title="Restore this backup?"
          description={`Its ${confirming?.franchises.length ?? 0} franchise(s) come back as new, inactive franchises next to the ones you have; nothing is overwritten. Keep this tab open until it finishes.`}
        >
          <div className="flex justify-end gap-2 p-5">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={() => {
                if (confirming) onRestore(confirming);
                setConfirming(null);
              }}
            >
              Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
