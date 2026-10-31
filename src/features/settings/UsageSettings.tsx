import type { FunctionReturnType } from "convex/server";
import { Gauge } from "lucide-react";
import { api } from "@convex/_generated/api";
import { INGESTION_TARGETS } from "@shared/ingestion/targets";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { formatAge } from "@/lib/time";
import { useQuery } from "@/lib/convex/useQuery";
import { BudgetForm } from "./BudgetForm";

type Usage = FunctionReturnType<typeof api.ingestion.usage.summary>;
type ModelRow = Usage["byModel"][number];

const tokens = (n: number | null) => (n === null ? "—" : n.toLocaleString());
const dollars = (n: number | null) => (n === null ? "—" : `$${n.toFixed(n < 1 ? 4 : 2)}`);
const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);

const columns: DataColumn<ModelRow>[] = [
  { id: "model", header: "Model", value: (r) => r.model, minWidth: 200 },
  { id: "runs", header: "Runs", title: "Extractions", align: "right", value: (r) => r.extractions },
  { id: "tokens", header: "Tokens", align: "right", value: (r) => r.tokens, cell: (r) => tokens(r.tokens) },
  { id: "cost", header: "Cost", align: "right", value: (r) => r.costUsd, cell: (r) => dollars(r.costUsd) },
  {
    id: "latency",
    header: "Avg time",
    title: "Average time per extraction",
    align: "right",
    value: (r) => r.avgLatencyMs,
    cell: (r) => seconds(r.avgLatencyMs),
  },
];

function Recent({ recent }: { recent: Usage["recent"] }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {recent.map((r) => (
        <li key={r._id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
          <span className="font-medium">{INGESTION_TARGETS[r.targetKey].label}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.model}</span>
          <span className="num text-xs text-muted-foreground">
            {tokens(r.tokens)} tok · {seconds(r.latencyMs)} · {dollars(r.costUsd)}
          </span>
          <span className="num w-16 text-right text-xs text-subtle-foreground">{formatAge(r.at)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Usage and cost (FEATURES.md 5.11): tokens, cost and time per model, and the latest extractions. */
export function UsageSettings() {
  const usage = useQuery(api.ingestion.usage.summary, {});
  return (
    <Section
      title="Usage and cost"
      description={usage ? `The last ${usage.window} extractions, per model.` : undefined}
      variant="card"
    >
      <BudgetForm />
      {usage === undefined ? (
        <Skeleton className="mt-4 h-32" />
      ) : usage.byModel.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={Gauge}
          title="No extractions yet"
          description="Every screenshot read shows up here."
        />
      ) : (
        <div className="mt-4 space-y-4">
          <DataTable<ModelRow>
            id="settings-usage"
            data={usage.byModel}
            columns={columns}
            getRowId={(r) => r.model}
            identityColumn="model"
            primaryColumns={["runs", "cost"]}
            columnOptions={false}
          />
          <div>
            <h3 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              Latest
            </h3>
            <Recent recent={usage.recent} />
          </div>
        </div>
      )}
    </Section>
  );
}
