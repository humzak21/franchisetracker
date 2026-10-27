import { useMutation } from "convex/react";
import { CircleCheck, CircleX, FlaskConical } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Section } from "@/components/layout/Section";
import { ModelPicker } from "@/components/forms/ModelPicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";
import { ModelPresets } from "./ModelPresets";

const labelClass = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

/** OpenRouter status and the models extraction uses, primary then fallback. */
export function ExtractionSettings() {
  const settings = useQuery(api.ingestion.settings.get, {});
  return (
    <Section
      title="Extraction"
      description="Screenshots are read by vision models through OpenRouter."
      variant="card"
    >
      {settings === undefined ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="space-y-6">
          <ModelsForm settings={settings} />
          <ModelPresets presets={settings.presets} />
        </div>
      )}
    </Section>
  );
}

function ModelsForm({ settings }: { settings: FunctionReturnType<typeof api.ingestion.settings.get> }) {
  const save = useMutation(api.ingestion.settings.setModels);
  const [primary, setPrimary] = useState(settings.models.primary);
  const [fallback, setFallback] = useState(settings.models.fallback);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const presets = settings.presets.map((p) => p.model);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await save({ primary, fallback });
      setMessage({ ok: true, text: "Saved" });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, "Could not save the models.") });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="flex items-start gap-2 text-sm">
        {settings.openRouterConfigured ? (
          <>
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-win" /> OpenRouter key is set on the backend.
          </>
        ) : settings.fixtureMode ? (
          <>
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-warn" />
            <span>
              No OpenRouter key on this local backend: extraction answers with a built-in sample for each
              screen. Set <code className="text-xs">OPENROUTER_API_KEY</code> to read real screenshots.
            </span>
          </>
        ) : (
          <>
            <CircleX className="mt-0.5 size-4 shrink-0 text-loss" />
            <span>
              Set <code className="text-xs">OPENROUTER_API_KEY</code> on the Convex deployment (
              <code className="text-xs">npx convex env set OPENROUTER_API_KEY …</code>) to read screenshots.
            </span>
          </>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className={labelClass}>Primary model</span>
          <ModelPicker presets={presets} value={primary} onChange={setPrimary} aria-label="Primary model" />
        </div>
        <div className="space-y-1.5">
          <span className={labelClass}>Fallback model</span>
          <ModelPicker
            presets={presets}
            value={fallback}
            onChange={setFallback}
            aria-label="Fallback model"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm">
          Save models
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setPrimary(settings.defaults.primary);
            setFallback(settings.defaults.fallback);
          }}
        >
          Use defaults
        </Button>
        {message && (
          <span className={message.ok ? "text-sm text-win" : "text-sm text-loss"} aria-live="polite">
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
