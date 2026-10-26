import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import {
  formatStat,
  isStatKey,
  RECORD_SCOPE_LABELS,
  RECORD_SCOPES,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  type RecordScope,
} from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { byRegistryOrder, type Split } from "./split";

type RecordView = FunctionReturnType<typeof api.stats.records.book>[number];

const value = (r: RecordView) => (isStatKey(r.statKey) ? formatStat(r.statKey, r.value) : String(r.value));

function When({ record }: { record: RecordView }) {
  if (record.game) {
    return (
      <Link to="/games/$gameId" params={{ gameId: record.game._id }} className="hover:underline">
        {record.year} · {weekLabel(record.game.weekKey)}
        {record.game.opponentAbbr ? ` vs ${record.game.opponentAbbr}` : ""}
      </Link>
    );
  }
  return <>{record.scope === "career" ? `Through ${record.year}` : record.year}</>;
}

function RecordCard({ record }: { record: RecordView }) {
  const label = isStatKey(record.statKey) ? STAT_REGISTRY[record.statKey].label : record.statKey;
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm text-muted-foreground">{label}</h4>
        <span className="num font-display text-3xl leading-none font-bold text-primary">{value(record)}</span>
      </div>
      <div className="mt-2 text-sm">
        {record.holder ? (
          <Link
            to="/players/$playerId"
            params={{ playerId: record.holder.playerId }}
            className="font-medium hover:underline"
          >
            {record.holder.name}
          </Link>
        ) : (
          <span className="font-medium">Unknown</span>
        )}
        <span className="text-muted-foreground">
          {" "}
          · <When record={record} />
        </span>
      </div>
      {record.previous && (
        <p className="mt-1 text-xs text-subtle-foreground">
          Broke {record.previous.name}&rsquo;s{" "}
          {isStatKey(record.statKey)
            ? formatStat(record.statKey, record.previous.value)
            : record.previous.value}
          {record.previous.year ? ` (${record.previous.year})` : ""}
        </p>
      )}
    </article>
  );
}

/** The franchise records book (FEATURES.md 5.5): single game, season and career, as cards by category. */
export function RecordsBook({ split }: { split: Split }) {
  const [scope, setScope] = useState<RecordScope>("game");
  const records = useQuery(api.stats.records.book, { split, scope });

  return (
    <div className="space-y-5">
      <Segmented
        aria-label="Scope"
        value={scope}
        onChange={setScope}
        options={RECORD_SCOPES.map((s) => ({ value: s, label: RECORD_SCOPE_LABELS[s] }))}
      />
      {records === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No records yet"
          description="Records are set by the box scores you commit; the first game writes the first page of the book."
        />
      ) : (
        STAT_CATEGORIES.map((category) => {
          const inCategory = records
            .filter((r) => isStatKey(r.statKey) && STAT_REGISTRY[r.statKey].category === category)
            .sort(byRegistryOrder);
          if (inCategory.length === 0) return null;
          return (
            <Section key={category} title={STAT_CATEGORY_LABELS[category]}>
              <div className="@container grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
                {inCategory.map((r) => (
                  <RecordCard key={r._id} record={r} />
                ))}
              </div>
            </Section>
          );
        })
      )}
    </div>
  );
}
