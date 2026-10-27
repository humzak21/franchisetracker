import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { ModelPicker } from "@/components/forms/ModelPicker";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

/** Reads the screenshots again, with the configured models or one picked for this run. */
export function RerunSheet({
  setKey,
  open,
  onOpenChange,
}: {
  setKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useQuery(api.ingestion.settings.get, open ? {} : "skip");
  const extract = useMutation(api.ingestion.uploads.extract);
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (chosen?: string) => {
    setError(null);
    try {
      await extract({ setKey, model: chosen });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Could not start extraction."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Read again"
      description="Edits made in review are replaced by the new reading."
    >
      <div className="space-y-4">
        <Button variant="primary" size="lg" className="w-full" onClick={() => void run()}>
          Re-run with {settings ? settings.models.primary : "the configured models"}
        </Button>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (model.trim()) void run(model.trim());
          }}
        >
          <ModelPicker
            presets={settings?.presets.map((p) => p.model) ?? []}
            value={model}
            onChange={setModel}
            aria-label="Model for this run"
          />
          <Button type="submit" className="w-full" disabled={!model.trim()}>
            Read with this model
          </Button>
        </form>
        {error && <p className="text-sm text-loss">{error}</p>}
      </div>
    </BottomSheet>
  );
}
