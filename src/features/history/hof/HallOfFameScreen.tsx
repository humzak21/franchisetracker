import { Link } from "@tanstack/react-router";
import { Landmark, UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { retiredNumbers, wallOrder } from "@shared/history/hof";
import { currentSeasonYear } from "@shared/seasons/reports";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { HofCandidates } from "./HofCandidates";
import { JerseyPlaque } from "./JerseyPlaque";
import { StaffInductionSheet } from "./StaffInductionSheet";
import type { WallEntry } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

function RetiredNumbers({ items }: { items: WallEntry[] }) {
  const retired = retiredNumbers(items.map((i) => ({ ...i.entry, name: i.name })));
  if (retired.length === 0) return null;
  return (
    <Section title="Retired numbers" description="Nobody wears these again.">
      <ul className="flex flex-wrap gap-2">
        {retired.map((r) => (
          <li
            key={r._id}
            className="flex items-center gap-3 rounded-xl border-l-4 border-team-2 bg-team py-2 pr-4 pl-3 text-team-foreground shadow-sm"
          >
            <span className="num font-display text-3xl leading-none font-bold">{r.jersey}</span>
            <span className="text-sm leading-tight">
              <span className="block font-semibold">{r.name}</span>
              <span className="block text-xs opacity-75">Retired {r.inductedYear}</span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Hall of Fame (FEATURES.md 5.7): a wall of hanging jerseys in team colors, oldest class first,
 * and the retired numbers above it. Two jerseys across on a phone, up to five on a desktop.
 */
export function HallOfFameScreen() {
  const active = useFranchise();
  const items = useQuery(api.hof.entries.wall, {});
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Doc<"hofEntries"> | null>(null);
  const year = active
    ? currentSeasonYear(active.seasons, active.franchise.startYear)
    : new Date().getFullYear();
  const wall = items
    ? wallOrder(
        items.map((i) => ({
          ...i,
          inductedYear: i.entry.inductedYear,
          retiredNumber: i.entry.retiredNumber,
        })),
      )
    : [];

  return (
    <Page
      title="Hall of Fame"
      eyebrow="History"
      back={{ to: "/history", label: "History" }}
      actions={
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <UserPlus /> <span className="max-sm:sr-only">Induct a coach</span>
        </Button>
      }
    >
      {items === undefined ? (
        <div className="grid grid-cols-2 gap-4 @tablet:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/5] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          size="page"
          icon={Landmark}
          title="The wall is empty"
          description="Induct a legend from their player page, or add a coach here."
          action={
            <Button asChild variant="outline">
              <Link to="/players">Find a player</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <RetiredNumbers items={items} />
          <section
            aria-label="Jersey wall"
            className="rounded-2xl border border-border bg-gradient-to-b from-surface-2 to-background px-3 pt-6 pb-4 @tablet:px-6 @tablet:pt-8"
          >
            <ul className="grid grid-cols-2 gap-x-3 gap-y-8 @tablet:grid-cols-3 @tablet:gap-x-6 @desktop:grid-cols-5">
              {wall.map((item) => (
                <li key={item.entry._id}>
                  <JerseyPlaque item={item} onEditStaff={() => setEditing(item.entry)} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      <HofCandidates className="mt-8" />
      <StaffInductionSheet
        key={`new-${String(adding)}`}
        defaultYear={year}
        open={adding}
        onOpenChange={setAdding}
      />
      {editing && (
        <StaffInductionSheet
          key={editing._id}
          entry={editing}
          defaultYear={year}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </Page>
  );
}
