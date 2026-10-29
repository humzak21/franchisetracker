import { useMutation } from "convex/react";
import { Medal } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AWARD_INFO } from "@shared/domain";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { AssignAwardSheet } from "./AssignAwardSheet";
import { AwardRow } from "./AwardRow";
import { CoachSheet } from "./CoachSheet";
import { ConferenceHeading } from "./ConferenceHeading";
import { HeroAward } from "./HeroAward";
import { seasonBoard, type ResolvedSlot } from "./seasonSlots";
import { SlotMenu } from "./SlotMenu";
import type { CountedAward, SeasonAward, SlotKey } from "./types";
import { UnfilledSlots } from "./UnfilledSlots";

const list = "divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface";
const slotKey = (s: SlotKey) => ({ type: s.type, conference: s.conference });

/**
 * The season's awards (FEATURES.md 5.8): the league-wide awards up top, the per-conference awards
 * in an AFC and an NFC column, then the awards counted live from league stats and weekly awards.
 * Only awards with a winner show; the rest wait in "Not awarded yet". Any award can be assigned
 * by hand, which overrides the import or the count.
 */
export function SeasonAwards({
  seasonId,
  awards,
  counted,
}: {
  seasonId: Id<"seasons">;
  awards: SeasonAward[];
  counted: CountedAward[] | undefined;
}) {
  const clear = useMutation(api.awards.assign.clear);
  const [assigning, setAssigning] = useState<SlotKey | null>(null);
  const board = seasonBoard(awards, counted);

  const menu = (slot: ResolvedSlot) => (
    <SlotMenu
      type={slot.type}
      label={`${slot.conference ?? ""} ${AWARD_INFO[slot.type].label}`.trim()}
      assigned={slot.assigned}
      onAssign={() => setAssigning(slotKey(slot))}
      onClear={() => void clear({ seasonId, ...slotKey(slot) })}
    />
  );
  const rows = (slots: ResolvedSlot[]) =>
    slots.flatMap((slot) =>
      slot.winners.map((w, i) => (
        <AwardRow
          key={`${slot.type}-${i}`}
          award={w}
          label={AWARD_INFO[slot.type].short ?? AWARD_INFO[slot.type].label}
          action={menu(slot)}
        />
      )),
    );

  const hasLeague = board.league.filled.length > 0 || board.unplaced.length > 0;
  const hasConference = board.conferences.some((c) => c.filled.length > 0);
  const madden = hasLeague || hasConference;
  const stats = board.stats.filled.length > 0 && (
    <Section
      key="stats"
      title="From the stats"
      description="League leaders across league stats and weekly awards, counted live until you assign a winner."
    >
      <ul className={list}>{rows(board.stats.filled)}</ul>
    </Section>
  );

  return (
    <div className="space-y-8">
      {/* Madden names its winners after the season; until then the live count is the news. */}
      {!madden && stats}
      {hasLeague && (
        <Section title="League awards" description="Won once across the league, whatever the conference.">
          <div className="grid gap-3 @tablet:grid-cols-2 @desktop:grid-cols-3">
            {board.league.filled.flatMap((slot) =>
              slot.winners.map((w, i) => (
                <HeroAward key={`${slot.type}-${i}`} award={w} action={menu(slot)} />
              )),
            )}
            {board.unplaced.map((w) => (
              <HeroAward key={w._id} award={w} />
            ))}
          </div>
        </Section>
      )}
      {hasConference && (
        <Section title="Conference awards" description="One winner in each conference.">
          <div className="grid gap-6 @desktop:grid-cols-2">
            {board.conferences.map(({ conference, filled }) => (
              <div key={conference} className="space-y-2">
                <ConferenceHeading
                  conference={conference}
                  detail={`${filled.length} award${filled.length === 1 ? "" : "s"}`}
                />
                {filled.length > 0 ? (
                  <ul className={list}>{rows(filled)}</ul>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">No {conference} winners yet.</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {madden && stats}
      {!madden && !stats && (
        <EmptyState
          icon={Medal}
          title="No season awards yet"
          description="Capture the end-of-season awards screens, or assign a winner from the list below."
        />
      )}
      <UnfilledSlots
        groups={[
          { title: "League", slots: board.league.empty.map(slotKey) },
          ...board.conferences.map((c) => ({ title: c.conference, slots: c.empty.map(slotKey) })),
          { title: "From the stats", slots: board.stats.empty.map(slotKey) },
        ]}
        onAssign={setAssigning}
      />
      <AssignAwardSheet
        seasonId={seasonId}
        slot={assigning && !AWARD_INFO[assigning.type].coach ? assigning : null}
        contenders={assigning ? board.contenders(assigning.type) : []}
        onClose={() => setAssigning(null)}
      />
      <CoachSheet
        seasonId={seasonId}
        open={assigning !== null && AWARD_INFO[assigning.type].coach === true}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}
