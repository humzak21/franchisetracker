import { Button } from "@/components/ui/button";
import type { RestoreState } from "./useRestore";

/** Where a restore is: reading the file, writing rows (with a bar), finished or failed. */
export function RestoreProgress({ state, onDismiss }: { state: RestoreState; onDismiss: () => void }) {
  if (state.phase === "idle") return null;
  if (state.phase === "reading") {
    return <p className="text-sm text-muted-foreground">Reading the backup…</p>;
  }
  if (state.phase === "writing") {
    const percent = Math.round((state.done / Math.max(state.total, 1)) * 100);
    return (
      <div className="space-y-1.5 rounded-xl border border-border bg-surface p-3">
        <div className="flex justify-between text-sm">
          <span>Restoring… keep this tab open</span>
          <span className="num text-muted-foreground">
            {state.done.toLocaleString()} / {state.total.toLocaleString()}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Restore progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div
      role={state.phase === "failed" ? "alert" : "status"}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm"
    >
      <span className="min-w-0 flex-1">
        {state.phase === "done"
          ? `Restored ${state.franchises.join(" and ")} (${state.rows.toLocaleString()} rows). Its records rebuild in the background; switch to it from the franchise menu.`
          : state.message}
      </span>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
