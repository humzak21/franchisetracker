import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { PaceBar } from "@/components/data/PaceBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

const dollars = (n: number) => `$${n.toFixed(2)}`;

/** The monthly extraction budget: what is spent so far, and the limit, which can be left blank. */
export function BudgetForm() {
  const budget = useQuery(api.ingestion.budget.status, {});
  const save = useMutation(api.ingestion.budget.set);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (budget === undefined) return <Skeleton className="h-16" />;
  const value = draft ?? (budget.budgetUsd === null ? "" : String(budget.budgetUsd));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await save({ budgetUsd: value.trim() === "" ? null : Number(value) });
      setDraft(null);
      setMessage("Saved");
    } catch (err) {
      setMessage(errorMessage(err, "Could not save the budget."));
    }
  };

  return (
    <div className="space-y-3">
      {budget.budgetUsd !== null && (
        <PaceBar
          label="This month"
          accessibleLabel="Extraction spend this month"
          value={budget.spentUsd}
          target={budget.budgetUsd}
          reading={`${dollars(budget.spentUsd)} of ${dollars(budget.budgetUsd)}`}
          caption={
            budget.level === "over"
              ? "Spent. New screenshots wait until next month or a higher budget."
              : "A banner shows from 80 percent; at the limit, screenshots wait instead of being read."
          }
        />
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void submit(e)}>
        <label className="space-y-1 text-sm font-medium">
          <span className="block">Monthly budget, dollars</span>
          <Input
            className="w-32"
            inputMode="decimal"
            placeholder="No limit"
            value={value}
            onChange={(e) => {
              setDraft(e.target.value);
              setMessage(null);
            }}
          />
        </label>
        <Button type="submit" size="sm" variant="outline">
          Save
        </Button>
        {budget.budgetUsd === null && (
          <span className="num pb-2 text-xs text-muted-foreground">
            {dollars(budget.spentUsd)} so far this month
          </span>
        )}
        {message && (
          <span role="status" className="pb-2 text-xs text-muted-foreground">
            {message}
          </span>
        )}
      </form>
    </div>
  );
}
