import { Link } from "@tanstack/react-router";
import { ChevronRight, CircleAlert, FileJson, LoaderCircle } from "lucide-react";
import { useRef } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useGameFileImport } from "./useGameFileImport";

type GameFileImportProps = {
  /** The game page's game: a file for another week is refused. */
  gameId?: Id<"games">;
  /** In a page header: a quiet button whose label shows from tablet width up. */
  inHeader?: boolean;
};

/**
 * Takes one or several exported game logs (`npm run export:madden`, docs/MADDEN-SAVE.md) and
 * files each for review under its season and week, as a game log entered by hand would be.
 */
export function GameFileImport({ gameId, inHeader = false }: GameFileImportProps) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, outcomes, run, dismiss } = useGameFileImport(gameId);
  const filed = outcomes?.filter((o) => o.ok).length ?? 0;

  return (
    <>
      <Button
        size="sm"
        variant={inHeader ? "ghost" : "outline"}
        disabled={busy}
        aria-label="Import game file"
        onClick={() => input.current?.click()}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <FileJson />}
        <span className={cn(inHeader && "hidden @tablet:inline")}>Import game file</span>
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".json,application/json"
        aria-label="Game files"
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void run(files);
        }}
      />
      <BottomSheet
        open={outcomes !== null}
        onOpenChange={(open) => !open && dismiss()}
        title="Game files"
        description={`${filed} of ${outcomes?.length ?? 0} filed for review`}
      >
        <ul className="space-y-2" aria-label="Imported game files">
          {outcomes?.map((o) => (
            <li key={o.file}>
              {o.ok ? (
                <Link
                  to="/inbox/manual/$draftId"
                  params={{ draftId: o.draftId }}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="num block truncate font-medium">{o.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{o.file}</span>
                  </span>
                  <span className="text-sm text-primary">Review</span>
                  <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
                </Link>
              ) : (
                <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 py-2">
                  <CircleAlert className="size-4 shrink-0 text-loss" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.file}</span>
                    <span className="block text-xs text-loss">{o.error}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
