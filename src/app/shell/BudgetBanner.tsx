import { Link, useRouterState } from "@tanstack/react-router";
import { CircleDollarSign, X } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";

const dollars = (n: number) => `$${n.toFixed(2)}`;

/**
 * The extraction budget (FEATURES.md 5.11): a warning from 80 percent, and word that screenshots
 * are being held once it is spent. Dismissing lasts until the app is next opened.
 */
export function BudgetBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const budget = useQuery(api.ingestion.budget.status, {});
  const [dismissed, setDismissed] = useState(false);
  if (!budget || dismissed || pathname === "/settings") return null;
  if (budget.level !== "warn" && budget.level !== "over") return null;
  const over = budget.level === "over";

  return (
    <div role="status" className="border-b border-border bg-elite-1">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2 text-sm @tablet:px-6">
        <CircleDollarSign className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">
            {over ? "Extraction budget spent" : "Extraction budget nearly spent"}
          </span>
          <span className="num text-muted-foreground max-sm:hidden">
            {" "}
            {dollars(budget.spentUsd)} of {dollars(budget.budgetUsd ?? 0)}
            {over ? ". New screenshots wait until next month" : " this month"}
          </span>
        </span>
        <Button asChild size="sm" variant="primary">
          <Link to="/settings">Settings</Link>
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss for now"
          onClick={() => setDismissed(true)}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
