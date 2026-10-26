import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MatchCandidate } from "@/components/player/MatchCandidate";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";

type Candidate = FunctionReturnType<typeof api.players.espn.search>[number];

/** Finds the player on ESPN and confirms the match: the ESPN id, missing bio and the headshot. */
export function EspnMatchSheet({
  playerId,
  name,
  open,
  onOpenChange,
}: {
  playerId: Id<"players">;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const search = useAction(api.players.espn.search);
  const confirm = useAction(api.players.espn.confirm);
  const [query, setQuery] = useState(name);
  /** Null while a search is in flight. */
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searched = useRef(false);

  const fetchResults = useCallback(
    (text: string) =>
      search({ playerId, query: text }).then(setResults, (e: unknown) => {
        setError(errorMessage(e, "ESPN search failed; try again in a moment"));
        setResults([]);
      }),
    [search, playerId],
  );
  // The first search runs when the sheet first opens; later ones come from the form.
  useEffect(() => {
    if (!open || searched.current) return;
    searched.current = true;
    void fetchResults(name);
  }, [open, name, fetchResults]);
  const run = (text: string) => {
    setResults(null);
    setError(null);
    void fetchResults(text);
  };

  const pick = async ({ espnId, league }: Candidate) => {
    setSaving(espnId);
    setError(null);
    try {
      await confirm({ playerId, espnId, league });
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Could not save the match"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Match on ESPN"
      description="Pick the real player, NFL or college prospect, to add the headshot and fill missing bio."
    >
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search ESPN" />
        <Button type="submit" variant="outline" aria-label="Search" disabled={results === null}>
          <Search />
        </Button>
      </form>
      {error && <p className="mb-2 text-sm text-loss">{error}</p>}
      <div className="space-y-2">
        {results === null ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No ESPN players match that name.</p>
        ) : (
          results.map((c) => (
            <MatchCandidate
              key={c.espnId}
              candidate={c}
              action={
                <Button size="sm" variant="primary" disabled={saving !== null} onClick={() => void pick(c)}>
                  {saving === c.espnId ? "Saving…" : "This is him"}
                </Button>
              }
            />
          ))
        )}
      </div>
    </BottomSheet>
  );
}
