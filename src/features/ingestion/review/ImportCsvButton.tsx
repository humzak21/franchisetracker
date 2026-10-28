import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { rowsFromCsv } from "@shared/ingestion/rows/csvRows";
import { isRowDraft, rowTarget } from "@shared/ingestion/targets";
import { Button } from "@/components/ui/button";
import { useReviewDraft } from "./reviewDraft";

/**
 * Adds a list's rows from a CSV file: a header row naming the columns (player, team, season,
 * the list's own fields), then one row per entry. The rows land accepted, for review.
 */
export function ImportCsvButton() {
  const { draft, update } = useReviewDraft();
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!isRowDraft(draft)) return null;
  const { spec } = rowTarget(draft.target);

  const read = async (file: File) => {
    const { rows, ignored } = rowsFromCsv(await file.text(), spec, draft);
    update((d) => (isRowDraft(d) ? { ...d, rows: [...d.rows, ...rows] } : d));
    setNote(
      `Added ${rows.length} row${rows.length === 1 ? "" : "s"} from ${file.name}` +
        (ignored.length > 0 ? `; ignored ${ignored.join(", ")}` : ""),
    );
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
        <FileSpreadsheet /> Import CSV
      </Button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void read(file);
        }}
      />
      {note && (
        <span role="status" className="basis-full text-xs text-muted-foreground">
          {note}
        </span>
      )}
    </>
  );
}
