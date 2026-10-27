import type { Averages, RosterAverages as Summary } from "@shared/roster/averages";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Skeleton } from "@/components/ui/misc";

const GROUPS = [
  { key: "team", label: "Team" },
  { key: "offense", label: "Offense" },
  { key: "defense", label: "Defense" },
  { key: "special", label: "Special teams" },
] as const;

const one = (n: number | null) => (n === null ? "—" : n.toFixed(1));

function Detail({ averages }: { averages: Averages }) {
  return (
    <>
      Age <span className="num font-medium text-foreground">{one(averages.age)}</span> · Exp{" "}
      <span className="num font-medium text-foreground">{one(averages.exp)}</span>
    </>
  );
}

/**
 * Average OVR (the headline), age and experience for the team and each side of the ball. Players
 * released or traded away do not count; unknown values are skipped.
 */
export function RosterAverages({ averages }: { averages: Summary | undefined }) {
  return (
    <TileStrip>
      {GROUPS.map(({ key, label }) => {
        const group = averages?.[key];
        return group ? (
          <Tile
            key={key}
            label={`${label} · ${group.count}`}
            value={
              <>
                {one(group.ovr)}
                <span className="ml-1 font-sans text-xs font-semibold text-muted-foreground">avg OVR</span>
              </>
            }
            detail={<Detail averages={group} />}
            accent={key === "team"}
          />
        ) : (
          <Skeleton key={key} className="h-[88px] rounded-xl" />
        );
      })}
    </TileStrip>
  );
}
