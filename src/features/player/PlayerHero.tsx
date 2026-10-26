import { DEV_TRAIT_LABELS, POSITION_INFO } from "@shared/domain";
import { ageInSeason, formatAcquisition } from "@shared/players/format";
import { Headshot } from "@/components/player/Headshot";
import { PositionBadge } from "@/components/player/PositionBadge";
import { TeamChip } from "@/components/team/TeamChip";
import type { PlayerPage } from "./types";

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
        {label}
      </dt>
      <dd className="num truncate font-display text-2xl leading-tight font-bold">{value ?? "—"}</dd>
    </div>
  );
}

/** Player identity at a glance: headshot in team colors, position, number and the current season's facts. */
export function PlayerHero({ page }: { page: PlayerPage }) {
  const { player, history } = page;
  const latest = history[history.length - 1];
  const team = latest?.team;
  const position = latest?.entry.position ?? player.position;
  const age = latest ? (latest.entry.age ?? ageInSeason(player, latest.year)) : null;
  const acquisition = formatAcquisition(latest?.entry.acquisition ?? history[0]?.entry.acquisition);

  return (
    <section className="@container relative overflow-hidden rounded-2xl border border-border bg-surface">
      {team && (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: `linear-gradient(${team.primaryColor}, ${team.secondaryColor})` }}
        />
      )}
      <div className="flex flex-col gap-5 p-5 pl-6 @tablet:flex-row @tablet:items-center @tablet:p-6 @tablet:pl-8">
        <Headshot name={player.displayName} team={team} size="xl" className="ring-2 ring-border-strong" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PositionBadge position={position} />
            <span>{POSITION_INFO[position].label}</span>
            {latest?.entry.jersey != null && <span className="num">#{latest.entry.jersey}</span>}
            {latest?.entry.devTrait && latest.entry.devTrait !== "normal" && (
              <span>· {DEV_TRAIT_LABELS[latest.entry.devTrait]}</span>
            )}
          </div>
          <h2 className="mt-1.5 font-display text-4xl leading-none font-bold tracking-wide uppercase @tablet:text-5xl">
            {player.displayName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {team && <TeamChip team={team} label="full" size="xs" />}
            {acquisition && <span>{acquisition}</span>}
            {latest?.entry.acquisition?.detail && <span>· {latest.entry.acquisition.detail}</span>}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 @tablet:gap-8">
          <Fact label="OVR" value={latest?.entry.ovr} />
          <Fact label="Age" value={age} />
          <Fact label="College" value={player.college} />
        </dl>
      </div>
    </section>
  );
}
