import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";

const labelClass = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

/** The models the pickers offer: the defaults, plus ids saved here or by saving a model above. */
export function ModelPresets({ presets }: { presets: readonly { model: string; saved: boolean }[] }) {
  const add = useMutation(api.ingestion.settings.addPreset);
  const remove = useMutation(api.ingestion.settings.removePreset);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await add({ model: draft });
      setDraft("");
    } catch (err) {
      setError(errorMessage(err, "Could not save the model."));
    }
  };

  return (
    <div className="space-y-3">
      <span className={labelClass}>Saved models</span>
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Saved models">
        {presets.map(({ model, saved }) => (
          <li key={model} className="flex min-h-11 items-center gap-2 py-1 pr-1 pl-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{model}</span>
            {saved ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${model}`}
                onClick={() => void remove({ model })}
              >
                <X />
              </Button>
            ) : (
              <Badge tone="neutral" className="mr-2">
                Default
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="vendor/model from openrouter.ai/models"
          aria-label="Model to save"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={!draft.trim()}>
          <Plus /> Add
        </Button>
      </form>
      {error && <p className="text-sm text-loss">{error}</p>}
    </div>
  );
}
