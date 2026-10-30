import { Section } from "@/components/layout/Section";
import { AttentionList } from "./AttentionList";
import { BoxScoreEditor } from "./BoxScoreEditor";
import { GameHeaderFields } from "./GameHeaderFields";
import { PlaysEditor } from "./PlaysEditor";
import { useReviewDraft } from "./reviewDraft";
import { RowsEditor } from "./RowsEditor";
import { TeamStatsEditor } from "./TeamStatsEditor";

/**
 * The editable draft of any target: what needs a look first, then the list or the game. Shared
 * by review of screenshots and by manual entry, so both edit and check a draft the same way.
 */
export function DraftEditor() {
  const { draft } = useReviewDraft();
  return (
    <>
      <AttentionList />
      {"rows" in draft ? (
        <RowsEditor />
      ) : (
        <>
          <Section title="Final score" variant="card">
            <GameHeaderFields />
          </Section>
          {"lines" in draft && (
            <Section title="Players">
              <BoxScoreEditor />
            </Section>
          )}
          {"teams" in draft && (
            <Section title="Team stats">
              <TeamStatsEditor />
            </Section>
          )}
          {draft.target === "game_log" && <PlaysEditor />}
        </>
      )}
    </>
  );
}
