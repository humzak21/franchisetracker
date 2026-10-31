import { Link } from "@tanstack/react-router";
import { ScanSearch } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { counted } from "@shared/ops/maintenance";
import { Notice } from "@/components/data/Notice";
import { useQuery } from "@/lib/convex/useQuery";

/** Seasons named before the rest are only counted, so a long gap stays one line. */
const SHOWN_SEASONS = 3;

/** Says so when games have no box score: per-game lists can run low, never high. */
export function MissingBoxScores() {
  const missing = useQuery(api.stats.reconcile.missingBoxScores, {});
  if (!missing || missing.length === 0) return null;
  const games = missing.reduce((n, s) => n + s.weeks.length, 0);
  const named = missing
    .slice(0, SHOWN_SEASONS)
    .map((s) => `${s.year} ${s.weeks.map((w) => weekLabel(w)).join(", ")}`)
    .join("; ");
  const more = missing.length > SHOWN_SEASONS ? "; and more" : "";
  return (
    <Notice icon={ScanSearch}>
      {counted(games, "game")} with no box score ({named}
      {more}), so these numbers can run low.{" "}
      <Link to="/stats/reconcile" className="underline">
        Reconcile
      </Link>
    </Notice>
  );
}
