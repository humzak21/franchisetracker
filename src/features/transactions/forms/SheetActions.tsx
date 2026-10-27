import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The bottom of a move sheet: the save error, a delete that asks once more (it also undoes the
 * move's roster changes), and the submit button.
 */
export function SheetActions({
  error,
  saving,
  saveLabel,
  onDelete,
}: {
  error: string | null;
  saving: boolean;
  saveLabel: string;
  onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {onDelete && (
          <Button
            variant={confirming ? "destructive" : "ghost"}
            disabled={saving}
            onClick={() => (confirming ? onDelete() : setConfirming(true))}
          >
            <Trash2 /> {confirming ? "Delete for good" : "Delete"}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={saving} className="ml-auto">
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
