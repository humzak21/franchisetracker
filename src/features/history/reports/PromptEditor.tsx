import { useMutation } from "convex/react";
import { CircleCheck, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PROMPT_LABELS, type ReportPrompt } from "@shared/seasons/reports";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";

const FIELD = { preseason: "preseasonThoughts", postseason: "postseasonThoughts" } as const;

/**
 * One report prompt: the question, an autosaving editor, and "File report", which saves the
 * latest text first so filing straight from the keyboard never loses the last sentence.
 */
export function PromptEditor({
  seasonId,
  prompt,
  text,
  answeredAt,
  canFile,
  waitingFor,
}: {
  seasonId: Id<"seasons">;
  prompt: ReportPrompt;
  text: string | undefined;
  answeredAt: number | undefined;
  /** False until the prompt can be answered (the post-season one waits for the Super Bowl week). */
  canFile: boolean;
  waitingFor?: string;
}) {
  const saveText = useMutation(api.seasons.reports.saveText);
  const answer = useMutation(api.seasons.reports.answer);
  const [draft, setDraft] = useState(text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const labels = PROMPT_LABELS[prompt];
  const onSave = useCallback(
    (next: string) => saveText({ seasonId, field: FIELD[prompt], text: next }),
    [saveText, seasonId, prompt],
  );

  const file = async () => {
    setError(null);
    setFiling(true);
    try {
      await onSave(draft);
      await answer({ seasonId, prompt });
    } catch (err) {
      setError(errorMessage(err, "Not filed. Try again."));
    } finally {
      setFiling(false);
    }
  };

  return (
    <Section
      title={labels.title}
      description={labels.question}
      variant="card"
      actions={
        answeredAt ? (
          <Badge tone="win">
            <CircleCheck className="size-3" /> Filed {new Date(answeredAt).toLocaleDateString()}
          </Badge>
        ) : canFile ? (
          <Badge tone="warn">Due</Badge>
        ) : undefined
      }
    >
      <NotesEditor
        label="Your thoughts"
        value={text}
        rows={7}
        onSave={onSave}
        onDraftChange={setDraft}
        placeholder="Write freely; it saves when you leave the field."
      />
      {!answeredAt && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          {error && <p className="mr-auto text-sm text-loss">{error}</p>}
          {canFile ? (
            <Button variant="primary" onClick={() => void file()} disabled={filing || !draft.trim()}>
              <Send /> File report
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{waitingFor}</p>
          )}
        </div>
      )}
    </Section>
  );
}
