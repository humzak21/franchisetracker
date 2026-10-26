import { useAction, useConvex } from "convex/react";
import { DatabaseBackup, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { gamesCsv, playerSeasonsCsv } from "@shared/ops/csv";
import { useFranchise } from "@/app/franchise";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/download";
import { errorMessage } from "@/lib/errors";
import { BackupList } from "./BackupList";
import { RestoreProgress } from "./RestoreProgress";
import { useRestore } from "./useRestore";

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Data (FEATURES.md 5.12): backups of every franchise (nightly and on demand) to download or
 * restore as new franchises, restoring from a file, and CSV exports of the active franchise.
 */
export function DataSettings() {
  const convex = useConvex();
  const active = useFranchise();
  const backUp = useAction(api.ops.backupRun.create);
  const { state, restore, reset } = useRestore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"backup" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restoring = state.phase === "reading" || state.phase === "writing";
  const name = slug(active?.franchise.name ?? "franchise");

  const run = async (kind: "backup" | "csv", work: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () =>
    run("csv", async () => {
      const [games, seasons] = await Promise.all([
        convex.query(api.games.directory.all, {}),
        convex.query(api.ops.exportData.playerSeasons, {}),
      ]);
      downloadFile(`${name}-games.csv`, gamesCsv(games), "text/csv");
      downloadFile(`${name}-player-seasons.csv`, playerSeasonsCsv(seasons), "text/csv");
    });

  return (
    <Section
      title="Data"
      description="Every franchise is backed up each night, as compressed JSON you can download. Restoring adds the backed-up franchises next to yours; nothing is overwritten."
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void run("backup", async () => void (await backUp({})))}
        >
          <DatabaseBackup /> {busy === "backup" ? "Backing up…" : "Back up now"}
        </Button>
      }
    >
      <div className="space-y-4">
        <BackupList
          busy={restoring}
          onRestore={(backup) => {
            if (backup.url) {
              const url = backup.url;
              void restore(async () => (await fetch(url)).arrayBuffer());
            }
          }}
        />
        <RestoreProgress state={state} onDismiss={reset} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={restoring} onClick={() => fileInput.current?.click()}>
            <Upload /> Restore from a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".gz,.json,application/gzip,application/json"
            className="sr-only"
            aria-label="Backup file to restore"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void restore(() => file.arrayBuffer());
            }}
          />
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void exportCsv()}>
            <FileSpreadsheet /> {busy === "csv" ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          CSV exports the active franchise&apos;s games and its players&apos; season totals. Screenshots in
          the inbox and Shortcut tokens are not in backups.
        </p>
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
      </div>
    </Section>
  );
}
