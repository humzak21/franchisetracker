import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BookOpenCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { MAX_FEW_SHOT } from "@shared/ingestion/prompt";
import { INGESTION_TARGETS } from "@shared/ingestion/targets";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatAge } from "@/lib/time";
import { useQuery } from "@/lib/convex/useQuery";

type Group = FunctionReturnType<typeof api.ingestion.corrections.list>[number];

const SHOWN = 6;
const shown = (v: string | number | boolean | null) => (v === null ? "nothing" : JSON.stringify(v));

function TargetGroup({ group }: { group: Group }) {
  const setUsed = useMutation(api.ingestion.corrections.setUsed);
  const remove = useMutation(api.ingestion.corrections.remove);
  const prune = useMutation(api.ingestion.corrections.prune);
  const [all, setAll] = useState(false);
  const used = group.corrections.filter((c) => c.usedAsExample).length;
  const list = all ? group.corrections : group.corrections.slice(0, SHOWN);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{INGESTION_TARGETS[group.targetKey].label}</h3>
        <Badge>{group.corrections.length}</Badge>
        <span className="text-xs text-muted-foreground">{Math.min(used, MAX_FEW_SHOT)} in the prompt</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void prune({ targetKey: group.targetKey })}
        >
          Clear
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {list.map((c) => (
          <li key={c._id} className="flex min-h-12 items-center gap-2 px-3 py-1.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs text-muted-foreground" title={c.fieldPath}>
                {c.fieldPath}
              </span>
              <span className="block truncate">
                read {shown(c.extracted)}, fixed to{" "}
                <span className="font-semibold">{shown(c.corrected)}</span>
              </span>
            </span>
            <span className="num hidden text-xs text-subtle-foreground sm:inline">{formatAge(c.at)}</span>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={c.usedAsExample}
              aria-label={`Use ${c.fieldPath} as an example`}
              className={cn(c.usedAsExample && "border-primary text-primary")}
              onClick={() => void setUsed({ correctionId: c._id, used: !c.usedAsExample })}
            >
              <BookOpenCheck />{" "}
              <span className="max-sm:sr-only">{c.usedAsExample ? "Example" : "Ignored"}</span>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete correction ${c.fieldPath}`}
              onClick={() => void remove({ correctionId: c._id })}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {group.corrections.length > SHOWN && (
        <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${group.corrections.length}`}
        </Button>
      )}
    </section>
  );
}

/**
 * Correction memory (FEATURES.md 5.11): what review fixed, per screen. The newest corrections
 * marked as examples are shown to the model next time; one-offs can be ignored or deleted.
 */
export function CorrectionsSettings() {
  const groups = useQuery(api.ingestion.corrections.list, {});
  return (
    <Section
      title="Correction memory"
      description={`Fixes from review, per screen. The newest ${MAX_FEW_SHOT} examples go into that screen's prompt.`}
      variant="card"
    >
      {groups === undefined ? (
        <Skeleton className="h-24" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No corrections yet"
          description="Anything you change in review is remembered here and shown to the model next time."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <TargetGroup key={g.targetKey} group={g} />
          ))}
        </div>
      )}
    </Section>
  );
}
