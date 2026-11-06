import { formatStat, getStat, yearOverYear, type StatKey } from "@shared/stats";
import { DeltaBadge } from "@/components/data/DeltaBadge";
import type { CareerCurvesData } from "./CareerCurves";

/** A stat season by season with each change, newest first; imported NFL seasons are marked. */
export function CareerYearTable({ stat, data }: { stat: StatKey; data: CareerCurvesData }) {
  const changes = yearOverYear(data.seasons, stat);
  const format = (value: number) => formatStat(stat, value);
  const { better, label } = getStat(stat);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface" data-swipe-ignore>
      <table className="w-full text-sm">
        <caption className="sr-only">{label} by season</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Season</th>
            <th className="px-3 py-2 text-right font-medium">Age</th>
            <th className="px-3 py-2 text-right font-medium">G</th>
            <th className="px-3 py-2 text-right font-medium">{getStat(stat).abbr}</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...changes].reverse().map((change) => {
            const season = data.seasons.find((s) => s.year === change.year);
            return (
              <tr key={change.year}>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <span className="num">{change.year}</span>
                  {season?.imported && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">NFL</span>
                  )}
                </th>
                <td className="num px-3 py-2 text-right text-muted-foreground">{season?.age ?? "—"}</td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{season?.gamesPlayed}</td>
                <td className="num px-3 py-2 text-right font-semibold">{format(change.value)}</td>
                <td className="px-3 py-2 text-right">
                  <DeltaBadge
                    delta={change.delta}
                    better={better}
                    format={format}
                    muted={change.smallSample}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
