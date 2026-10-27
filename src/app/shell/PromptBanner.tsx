import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { NotebookPen, X } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { isSnoozed, PROMPT_LABELS } from "@shared/seasons/reports";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";

/**
 * The pending-prompt banner (FEATURES.md 3): a report that is due, on every screen but Home
 * (which has the card) and the reports themselves. Dismissing snoozes it everywhere for a while;
 * the prompt stays due until it is filed.
 */
export function PromptBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pending = useQuery(api.seasons.reports.pending, {});
  const dismiss = useMutation(api.seasons.reports.dismiss);
  const [now] = useState(() => Date.now());
  const prompt = pending?.prompts.find((p) => !isSnoozed(p, now));
  if (!prompt || pathname === "/" || pathname.startsWith("/history/reports")) return null;

  return (
    <div role="status" className="border-b border-border bg-elite-1">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2 text-sm @tablet:px-6">
        <NotebookPen className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">
            {prompt.year} {PROMPT_LABELS[prompt.prompt].title.toLowerCase()}
          </span>
          <span className="text-muted-foreground max-sm:hidden"> is due</span>
        </span>
        <Button asChild size="sm" variant="primary">
          <Link to="/history/reports/$year" params={{ year: String(prompt.year) }}>
            Write it
          </Link>
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss for now"
          onClick={() => {
            // One banner for every due report: dismissing snoozes them all.
            for (const p of pending?.prompts ?? []) void dismiss({ seasonId: p.seasonId, prompt: p.prompt });
          }}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
