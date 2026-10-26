import { Check, ChevronDown } from "lucide-react";
import { formatRecord } from "@shared/stats";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { PHONE_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { isPreFranchise } from "@shared/history/nflverse";
import { useFranchise, type Season } from "../franchise";
import { useSeason } from "../season";

const statusTone = {
  upcoming: "neutral",
  regular: "accent",
  postseason: "solid",
  complete: "neutral",
} as const;

function SeasonList({
  seasons,
  selected,
  startYear,
  onPick,
}: {
  seasons: readonly Season[];
  selected?: number;
  startYear: number;
  onPick: (year: number) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {[...seasons].reverse().map((s) => (
        <li key={s._id}>
          <button
            type="button"
            onClick={() => onPick(s.year)}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-2",
              s.year === selected && "bg-elite-1 text-primary",
            )}
          >
            <span className="num font-display text-xl font-bold">{s.year}</span>
            {isPreFranchise(s.year, startYear) ? (
              <Badge title="Real NFL season before the franchise">NFL</Badge>
            ) : (
              <Badge tone={statusTone[s.status]}>{s.status}</Badge>
            )}
            {s.userRecord && (
              <span className="num ml-auto text-sm text-muted-foreground">{formatRecord(s.userRecord)}</span>
            )}
            {s.year === selected && <Check className={cn("size-4", !s.userRecord && "ml-auto")} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Season picker for the page header: a popover on wide screens, a bottom sheet on phones. Shortcut S. */
export function SeasonSwitcher() {
  const { seasons, season, setYear, pickerOpen, setPickerOpen } = useSeason();
  const startYear = useFranchise()?.franchise.startYear ?? 0;
  const phone = useMediaQuery(PHONE_QUERY);
  if (!season) return null;

  const pick = (year: number) => {
    setYear(year);
    setPickerOpen(false);
  };
  const trigger = (
    <Button
      variant="outline"
      size="sm"
      className="num gap-1 font-display text-base font-bold"
      aria-label={`Season ${season.year}, change season`}
    >
      {season.year}
      <ChevronDown className="size-3.5! opacity-60" />
    </Button>
  );

  if (phone) {
    return (
      <>
        <span onClick={() => setPickerOpen(true)}>{trigger}</span>
        <BottomSheet open={pickerOpen} onOpenChange={setPickerOpen} title="Season">
          <SeasonList seasons={seasons} selected={season.year} startYear={startYear} onPick={pick} />
        </BottomSheet>
      </>
    );
  }
  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="max-h-[70vh] w-64 overflow-y-auto p-1.5">
        <SeasonList seasons={seasons} selected={season.year} startYear={startYear} onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}
