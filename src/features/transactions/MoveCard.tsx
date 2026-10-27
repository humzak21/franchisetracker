import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { TRANSACTION_LABELS } from "@shared/domain";
import { formatMoney } from "@shared/roster/cap";
import { pickLabel, timingLabel } from "@shared/transactions";
import { PlayerChip } from "@/components/player/PlayerChip";
import { TeamChip } from "@/components/team/TeamChip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import type { Move } from "./types";

function People({
  label,
  people,
  picks,
}: {
  label: string;
  people: Move["playersIn"];
  picks: Move["picksIn"];
}) {
  if (people.length === 0 && picks.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {label}
      </div>
      {people.map((p, i) =>
        p.playerId ? (
          <Link
            key={i}
            to="/players/$playerId"
            params={{ playerId: p.playerId }}
            className="flex min-w-0 hover:underline pointer-coarse:touch-target"
          >
            <PlayerChip
              player={{ displayName: p.name, position: p.position ?? "", headshotUrl: p.headshotUrl }}
              size="sm"
            />
          </Link>
        ) : (
          <div key={i} className="text-sm font-medium">
            {p.name}
          </div>
        ),
      )}
      {picks.map((p, i) => (
        <div key={`pick-${i}`} className="text-sm">
          {pickLabel(p, p.origin)} pick
        </div>
      ))}
    </div>
  );
}

/** One move in the log: what it was, when, who came and went, the terms and the notes. */
export function MoveCard({
  move,
  onEdit,
  children,
}: {
  move: Move;
  /** Opens the move's edit sheet. */
  onEdit?: (move: Move) => void;
  children?: ReactNode;
}) {
  const c = move.contract;
  const terms = c
    ? [
        c.years && `${c.years} yr`,
        c.total !== undefined && formatMoney(c.total),
        c.apy !== undefined && `${formatMoney(c.apy)}/yr`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <article
      className={cn(
        "space-y-3 rounded-xl border bg-surface p-3",
        move.isUser ? "border-border" : "border-dashed border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={move.type === "trade" ? "accent" : move.type === "release" ? "loss" : "neutral"}>
          {TRANSACTION_LABELS[move.type]}
        </Badge>
        <span className="text-xs text-muted-foreground">{timingLabel(move.phase, move.weekKey)}</span>
        {move.team && <TeamChip team={move.team} label="abbr" size="xs" className="ml-auto text-xs" />}
        {move.counterpart && (
          <span className="text-xs text-muted-foreground">with {move.counterpart.abbr}</span>
        )}
        {onEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Edit ${TRANSACTION_LABELS[move.type].toLowerCase()}`}
            onClick={() => onEdit(move)}
            className={move.team ? undefined : "ml-auto"}
          >
            <Pencil />
          </Button>
        )}
      </div>
      <div className="grid gap-3 @sm:grid-cols-2">
        <People label="In" people={move.playersIn} picks={move.picksIn} />
        <People label="Out" people={move.playersOut} picks={move.picksOut} />
      </div>
      {terms && <p className="num text-sm">{terms}</p>}
      {move.notes && <p className="text-sm text-muted-foreground">{move.notes}</p>}
      {children}
    </article>
  );
}
