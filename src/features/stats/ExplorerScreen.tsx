import { useNavigate } from "@tanstack/react-router";
import { Compass, Link2, Telescope, X } from "lucide-react";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  EXPLORER_LIMIT,
  parseQuestion,
  questionSearch,
  settleQuestion,
  type ExplorerSearch,
  type Question,
} from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { QuestionBuilder } from "@/components/data/QuestionBuilder";
import { Page } from "@/components/layout/Page";
import { PlayerSearch } from "@/components/player/PlayerSearch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { ExplorerAnswer } from "./ExplorerAnswer";
import { MissingBoxScores } from "./MissingBoxScores";

/** The screen's question argument: the URL keeps a player's id as plain text. */
const asked = (q: Question) => ({ ...q, playerId: q.playerId as Id<"players"> | null });

function PlayerChoice({
  question,
  name,
  onChange,
}: {
  question: Question;
  name: string | null;
  onChange: (next: Question) => void;
}) {
  if (question.playerId === null) {
    return (
      <PlayerSearch
        placeholder="One player only (optional)"
        action={(hit) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...question, playerId: hit.playerId })}
          >
            Pick
          </Button>
        )}
      />
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Only</span>
      <span className="font-medium">{name ?? "this player"}</span>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Clear player"
        onClick={() => onChange({ ...question, playerId: null })}
      >
        <X />
      </Button>
    </div>
  );
}

/**
 * The stat explorer (STATS-HUB.md 3): a question built from a stat, a scope, a split and the rest,
 * answered as a list or as bars. The question lives in the URL, so a bookmark or a copied link
 * brings it back.
 */
export function ExplorerScreen({ search }: { search: ExplorerSearch }) {
  const navigate = useNavigate({ from: "/stats/explorer" });
  const active = useFranchise();
  const teams = useQuery(api.league.teams.list, {});
  const question = useMemo(() => parseQuestion(search), [search]);
  const result = useQuery(api.stats.explorer.run, { question: asked(question) });
  const startYear = active?.franchise.startYear ?? 0;
  const years = useMemo(
    () =>
      (active?.seasons ?? [])
        .map((s) => s.year)
        .filter((y) => y >= startYear)
        .sort((a, b) => a - b),
    [active, startYear],
  );
  const opponents = useMemo(
    () =>
      (teams ?? [])
        .filter((t) => t._id !== active?.franchise.userTeamId)
        .map((t) => t.abbr)
        .sort(),
    [teams, active],
  );
  const onChange = (next: Question) =>
    void navigate({ search: questionSearch(settleQuestion(next)), replace: true });
  const answered = result?.status === "answered" ? result : null;
  return (
    <Page
      title="Explorer"
      eyebrow="Stats"
      back={{ to: "/stats", label: "Stats" }}
      actions={<CopyButton text={() => window.location.href} label="Copy link" icon={Link2} />}
    >
      <div className="space-y-5">
        <QuestionBuilder
          question={question}
          onChange={onChange}
          years={years}
          opponents={opponents}
          player={
            <PlayerChoice
              question={question}
              name={answered?.rows[0]?.player.name ?? null}
              onChange={onChange}
            />
          }
        />
        <Notice icon={Compass}>
          Games with the team during the franchise: real seasons before it have no games. A split counts
          regular-season games unless it says playoffs.
        </Notice>
        <MissingBoxScores />
        {result === undefined ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : result.status === "refused" ? (
          <EmptyState icon={Telescope} title="That reads too many games" description={result.message} />
        ) : result.rows.length === 0 ? (
          <EmptyState
            icon={Telescope}
            title="Nobody fits that question"
            description="Try fewer limits, or capture more box scores."
          />
        ) : (
          <ExplorerAnswer
            question={question}
            rows={result.rows}
            total={result.total}
            limit={EXPLORER_LIMIT}
          />
        )}
      </div>
    </Page>
  );
}
