import { AWARD_INFO } from "@shared/domain";
import { allPro, cabinet, proBowl } from "@shared/awards/groups";
import { Section } from "@/components/layout/Section";
import { AwardCard } from "./AwardCard";
import type { SeasonAward } from "./types";

const grid = "grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3";

/** The yearly cabinet: MVP, players of the year, coach of the year, the Super Bowl MVP. */
export function Cabinet({ awards }: { awards: SeasonAward[] }) {
  return (
    <ul className={grid}>
      {cabinet(awards).flatMap(({ winners }) =>
        winners.map((w) => (
          <li key={w._id}>
            <AwardCard award={w} />
          </li>
        )),
      )}
    </ul>
  );
}

/** First and second team All-Pro in depth-chart order. */
export function AllPro({ awards }: { awards: SeasonAward[] }) {
  return (
    <div className="space-y-6">
      {allPro(awards).map(({ type, players }) =>
        players.length === 0 ? null : (
          <Section key={type} title={AWARD_INFO[type].label}>
            <ul className={grid}>
              {players.map((p) => (
                <li key={p._id}>
                  <AwardCard award={p} label={p.position ?? AWARD_INFO[type].label} />
                </li>
              ))}
            </ul>
          </Section>
        ),
      )}
    </div>
  );
}

/** Pro Bowl rosters, AFC then NFC. */
export function ProBowl({ awards }: { awards: SeasonAward[] }) {
  return (
    <div className="grid gap-6 @desktop:grid-cols-2">
      {proBowl(awards).map(({ conference, players }) => (
        <Section key={conference} title={`${conference} Pro Bowl`} description={`${players.length} players`}>
          <ul className="grid gap-2 @tablet:grid-cols-2">
            {players.map((p) => (
              <li key={p._id}>
                <AwardCard award={p} label={p.position ?? "Pro Bowl"} />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}
