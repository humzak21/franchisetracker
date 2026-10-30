import { Link } from "@tanstack/react-router";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ArrowRight, ChevronDown, UserCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { SeenIn } from "@/components/player/SeenIn";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";
import { TidyPlayers } from "./TidyPlayers";

/** Captured players checked per page; the newest come first, where duplicates turn up. */
const PAGE = 60;

type Pair = (typeof api.players.identity.duplicates)["_returnType"]["page"][number];
type Side = Pair["captured"];

function Who({ side }: { side: Side }) {
  return (
    <Link
      to="/players/$playerId"
      params={{ playerId: side.playerId }}
      className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary pointer-coarse:touch-target"
    >
      <PositionBadge position={side.position} />
      <span className="truncate font-medium">{side.displayName}</span>
      {side.imported && <Badge>NFL</Badge>}
    </Link>
  );
}

function Seen({ side }: { side: Side }) {
  const seen = useQuery(api.players.identity.seenIn, { playerId: side.playerId });
  return (
    <div className="min-w-0 flex-1 basis-60">
      <div className="truncate text-xs font-medium">{side.displayName}</div>
      {seen ? <SeenIn seen={seen} /> : <Skeleton className="h-10 rounded-lg" />}
    </div>
  );
}

function DuplicatePair({ pair, onMerge }: { pair: Pair; onMerge: () => void }) {
  const [open, setOpen] = useState(false);
  const { captured, match } = pair;
  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Who side={captured} />
        <ArrowRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
        <Who side={match} />
        <span className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            aria-label={`Where ${captured.displayName} and ${match.displayName} were seen`}
            onClick={() => setOpen(!open)}
          >
            Seen in <ChevronDown />
          </Button>
          <Button size="sm" variant="outline" onClick={onMerge}>
            Merge
          </Button>
        </span>
      </div>
      {open && (
        <div className="flex flex-wrap gap-4 rounded-lg bg-surface-2 p-2">
          <Seen side={captured} />
          <Seen side={match} />
        </div>
      )}
    </li>
  );
}

/** One row per pair: two captured players each name the other. */
function uniquePairs(pairs: readonly Pair[]) {
  const seen = new Set<string>();
  return pairs.filter(({ captured, match }) => {
    const key = [captured.playerId, match.playerId].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Identity tools (FEATURES.md 5.4) across the franchise: tidying older records, players entered
 * twice from box scores, and name corrections from review that still match players carrying the
 * misread name.
 */
export function IdentitySettings() {
  const scan = usePaginatedQuery(api.players.identity.duplicates, {}, { initialNumItems: PAGE });
  const corrections = useQuery(api.players.identity.nameCorrections, {});
  const merge = useMutation(api.players.identity.merge);
  const apply = useMutation(api.players.identity.applyNameCorrection);
  const [error, setError] = useState<string | null>(null);
  const attempt = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) => setError(errorMessage(e, "Could not update the players")));
  };

  const loading = scan.status === "LoadingFirstPage";
  const duplicates = uniquePairs(scan.results);
  const more = scan.status === "CanLoadMore" || scan.status === "LoadingMore";
  const empty = !loading && !more && duplicates.length === 0 && corrections?.length === 0;
  return (
    <Section
      title="Player identity"
      description="Merge duplicates and apply name corrections from review in bulk."
    >
      <TidyPlayers />
      {loading || corrections === undefined ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : empty ? (
        <EmptyState
          icon={UserCheck}
          title="Every player is one person"
          description="Nothing looks duplicated, and every corrected name is applied."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {duplicates.map((pair) => (
            <DuplicatePair
              key={`${pair.captured.playerId}-${pair.match.playerId}`}
              pair={pair}
              onMerge={() =>
                attempt(() => merge({ sourceId: pair.captured.playerId, targetId: pair.match.playerId }))
              }
            />
          ))}
          {corrections.map((c) => (
            <li key={`${c.from}-${c.to}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 text-sm">
              <span className="min-w-0">
                <span className="text-muted-foreground">Review fixed </span>
                <span className="font-medium">“{c.from}”</span>
                <span className="text-muted-foreground"> to </span>
                <span className="font-medium">“{c.to}”</span>
                <span className="block text-xs text-muted-foreground">
                  {c.players.length} player{c.players.length === 1 ? "" : "s"} still named “{c.from}”
                  {c.existing ? `; merges into ${c.existing.displayName}` : "; renames them"}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => attempt(() => apply({ from: c.from, to: c.to }))}
              >
                Apply
              </Button>
            </li>
          ))}
          {more && (
            <li className="p-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                disabled={scan.status === "LoadingMore"}
                onClick={() => scan.loadMore(PAGE)}
              >
                {scan.status === "LoadingMore" ? "Checking…" : "Check older players"}
              </Button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
    </Section>
  );
}
