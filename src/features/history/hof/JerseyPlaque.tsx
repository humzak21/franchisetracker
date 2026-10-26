import { Link } from "@tanstack/react-router";
import { isPosition } from "@shared/domain";
import { careerSpan, headlineStats } from "@shared/history/hof";
import { formatStat, STAT_REGISTRY, type StatLine } from "@shared/stats";
import { HangingJersey } from "@/components/team/HangingJersey";
import { Badge } from "@/components/ui/misc";
import { jerseyName, type WallEntry } from "./types";

function Plaque({ item }: { item: WallEntry }) {
  const { entry, name } = item;
  const span = careerSpan(entry.firstYear, entry.lastYear);
  const headlines =
    isPosition(entry.role) && entry.careerSummary
      ? headlineStats(entry.role, entry.careerSummary as StatLine, entry.careerGames ?? 0)
      : [];
  return (
    <div className="mt-3 rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-center shadow-sm">
      <div className="truncate font-display text-lg leading-tight font-bold tracking-wide uppercase">
        {name}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {[entry.role, span].filter(Boolean).join(" · ")}
      </div>
      <div className="mt-1.5 flex flex-wrap justify-center gap-1">
        <Badge tone="accent">Class of {entry.inductedYear}</Badge>
        {entry.retiredNumber && entry.jersey !== undefined && (
          <Badge tone="solid">#{entry.jersey} retired</Badge>
        )}
      </div>
      {headlines.length > 0 && (
        <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-border pt-2">
          {headlines.map((h) => (
            <div key={h.stat} className="flex min-w-0 flex-col-reverse">
              <dt className="truncate text-[10px] font-semibold tracking-wide text-subtle-foreground uppercase">
                {STAT_REGISTRY[h.stat].abbr}
              </dt>
              <dd className="num truncate font-display text-base leading-none font-bold">
                {formatStat(h.stat, h.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {entry.blurb && (
        <p className="mt-2 line-clamp-3 text-left text-xs text-muted-foreground">{entry.blurb}</p>
      )}
    </div>
  );
}

/** One inductee on the wall: their jersey under a spotlight and a plaque. Players link to their page. */
export function JerseyPlaque({ item, onEditStaff }: { item: WallEntry; onEditStaff: () => void }) {
  const body = (
    <>
      <div className="relative px-2">
        <div
          aria-hidden
          className="absolute inset-x-0 -top-4 h-3/4 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.14),transparent)]"
        />
        <HangingJersey
          team={item.team}
          number={item.entry.jersey}
          name={jerseyName(item.name)}
          className="relative"
        />
      </div>
      <Plaque item={item} />
    </>
  );
  return item.entry.playerId ? (
    <Link
      to="/players/$playerId"
      params={{ playerId: item.entry.playerId }}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
    >
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onEditStaff}
      className="block w-full rounded-xl text-left"
      aria-label={`Edit ${item.name}`}
    >
      {body}
    </button>
  );
}
