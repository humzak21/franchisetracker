import type { ReactNode } from "react";
import { DEV_TRAIT_LABELS, POSITION_INFO } from "@shared/domain";
import { ageInSeason, formatAcquisition, formatDraft, formatHeight } from "@shared/players/format";
import { PlayerCard } from "@/components/player/PlayerCard";
import { PositionBadge } from "@/components/player/PositionBadge";
import { TeamChip } from "@/components/team/TeamChip";
import { Badge } from "@/components/ui/misc";
import type { PlayerPage } from "./types";

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
        {label}
      </dt>
      <dd className="num truncate font-display text-xl leading-tight font-bold @tablet:text-2xl">
        {value ?? "—"}
      </dd>
    </div>
  );
}

/**
 * Player identity at a glance: the card (photo or monogram) in team colors, position, number,
 * bio, and the latest season's facts. Stacks on phones, side by side from tablet width.
 */
export function PlayerHero({ page, actions }: { page: PlayerPage; actions?: ReactNode }) {
  const { player, history, seasons } = page;
  const latest = history[history.length - 1];
  const lastStats = seasons[seasons.length - 1];
  const team = latest?.team ?? lastStats?.team;
  const position = latest?.entry.position ?? player.position;
  const year = latest?.year ?? lastStats?.year;
  const age = latest?.entry.age ?? (year === undefined ? null : ageInSeason(player, year));
  const acquisition = formatAcquisition(latest?.entry.acquisition);
  const trait = latest?.entry.devTrait;
  const years = seasons.map((s) => s.year);
  const draft = formatDraft(player.draft, page.draftTeamAbbr, player.undrafted);
  const bio = [player.college, draft && (draft === "Undrafted" ? draft : `Drafted ${draft}`)].filter(Boolean);

  return (
    <section className="@container relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-col gap-5 p-4 @tablet:flex-row @tablet:items-center @tablet:p-6">
        <PlayerCard
          className="mx-auto w-40 shrink-0 @tablet:mx-0 @tablet:w-44"
          player={{
            displayName: player.displayName,
            position,
            jersey: latest?.entry.jersey,
            headshotUrl: page.headshotUrl,
            team,
          }}
          caption={years.length ? `${Math.min(...years)}–${Math.max(...years)}` : undefined}
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <PositionBadge position={position} />
              <span>{POSITION_INFO[position].label}</span>
              {latest?.entry.jersey != null && <span className="num">#{latest.entry.jersey}</span>}
              {trait && trait !== "normal" && <Badge tone="accent">{DEV_TRAIT_LABELS[trait]}</Badge>}
              {!player.isReal && <Badge>Fictional</Badge>}
              {player.retired && <Badge>Retired</Badge>}
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
          <dl className="grid grid-cols-4 gap-x-4 gap-y-3">
            <Fact label="OVR" value={latest?.entry.ovr} />
            <Fact label="Age" value={age} />
            <Fact label="Height" value={formatHeight(player.heightIn)} />
            <Fact label="Weight" value={player.weightLb} />
          </dl>
          {bio.length > 0 && <p className="text-sm text-muted-foreground">{bio.join(" · ")}</p>}
          {latest?.entry.abilities && latest.entry.abilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {latest.entry.abilities.map((a) => (
                <Badge key={a} tone="accent">
                  {a}
                </Badge>
              ))}
            </div>
          )}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
