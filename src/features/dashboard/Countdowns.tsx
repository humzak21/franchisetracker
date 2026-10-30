import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CountdownList } from "@/components/data/CountdownList";
import { Section } from "@/components/layout/Section";
import { useQuery } from "@/lib/convex/useQuery";

const SHOWN = 3;

/** The three career marks the roster is nearest to; nothing at all until someone is within reach. */
export function Countdowns({ seasonId, className }: { seasonId: Id<"seasons">; className?: string }) {
  const items = useQuery(api.stats.hub.countdownsFor, { seasonId });
  if (!items || items.length === 0) return null;
  return (
    <Section title="Countdowns" variant="card" className={className}>
      <CountdownList items={items.slice(0, SHOWN)} />
    </Section>
  );
}
