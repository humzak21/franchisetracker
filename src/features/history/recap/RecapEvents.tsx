import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { weekLabel } from "@shared/domain";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import type { Recap } from "./types";

const row = "flex min-h-11 items-center gap-2.5 py-1.5 text-sm";
const list = "divide-y divide-border rounded-xl border border-border bg-surface px-3";

/** What the year set, changed and added: records, moves and the draft class. */
export function RecapEvents({ recap }: { recap: Recap }) {
  const { records, moves, draft } = recap;
  const hidden = moves.total - moves.rows.length;
  return (
    <>
      {records.length > 0 && (
        <Section title="Records set">
          <ul className={list}>
            {records.map((r) => (
              <li key={r._id} className={row}>
                <Trophy aria-hidden className="size-4 shrink-0 text-primary" />
                {r.gameId ? (
                  <Link
                    to="/games/$gameId"
                    params={{ gameId: r.gameId }}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    {r.title}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1">{r.title}</span>
                )}
                {r.weekKey && (
                  <span className="num shrink-0 text-xs text-muted-foreground">{weekLabel(r.weekKey)}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @tablet:grid-cols-2">
        {moves.rows.length > 0 && (
          <Section title="Moves">
            <ul className={list}>
              {moves.rows.map((m) => (
                <li key={m._id} className={row}>
                  {m.playerId ? (
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: m.playerId }}
                      className="min-w-0 hover:underline"
                    >
                      {m.label}
                    </Link>
                  ) : (
                    <span className="min-w-0">{m.label}</span>
                  )}
                </li>
              ))}
            </ul>
            {hidden > 0 && (
              <Link to="/transactions" className="mt-2 block text-sm text-primary underline">
                {hidden} more on Transactions
              </Link>
            )}
          </Section>
        )}
        {draft.length > 0 && (
          <Section title="Draft class">
            <ul className={list}>
              {draft.map((p) => (
                <li key={p._id} className={row}>
                  {p.position && <PositionBadge position={p.position} />}
                  {p.playerId ? (
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: p.playerId }}
                      className="min-w-0 hover:underline"
                    >
                      {p.label}
                    </Link>
                  ) : (
                    <span className="min-w-0">{p.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
