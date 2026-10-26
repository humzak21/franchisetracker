import { Link } from "@tanstack/react-router";
import { Check, ImageOff, Images, LoaderCircle } from "lucide-react";
import { weekLabel } from "@shared/domain";
import { INGESTION_TARGETS, isTargetKey } from "@shared/ingestion/targets";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatAge } from "@/lib/time";
import { STATUS, type InboxSet } from "./status";

type SetCardProps = {
  set: InboxSet;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
};

/** One upload set in the inbox grid: thumbnail, what it is, where it goes, and its status. */
export function SetCard({ set, selecting, selected, onToggle }: SetCardProps) {
  const cover = set.images[0]?.url;
  const target =
    set.targetKey && isTargetKey(set.targetKey) ? INGESTION_TARGETS[set.targetKey].label : "Untagged";
  const seasonScreen =
    set.targetKey && isTargetKey(set.targetKey) && INGESTION_TARGETS[set.targetKey].scope === "season";
  const where = [set.year, set.weekKey && !seasonScreen ? weekLabel(set.weekKey, "long") : null]
    .filter(Boolean)
    .join(" · ");
  const status = STATUS[set.status];

  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageOff className="absolute inset-0 m-auto size-6 text-subtle-foreground" />
        )}
        {set.images.length > 1 && (
          <span className="num absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-semibold text-white">
            <Images className="size-3.5" /> {set.images.length}
          </span>
        )}
        {set.status === "extracting" && (
          <span className="absolute inset-0 grid place-items-center bg-black/35">
            <LoaderCircle className="size-7 animate-spin text-white" />
          </span>
        )}
        {selecting && (
          <span
            aria-hidden
            className={cn(
              "absolute top-2 left-2 grid size-6 place-items-center rounded-full border-2 border-white shadow",
              selected ? "bg-primary text-primary-foreground" : "bg-black/30",
            )}
          >
            {selected && <Check className="size-3.5" strokeWidth={3} />}
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{target}</span>
          <Badge tone={status.tone} className="shrink-0 whitespace-nowrap">
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{where || "No season or week"}</span>
          <span className="shrink-0">{formatAge(set.createdAt)}</span>
        </div>
        {set.error && <p className="line-clamp-2 text-xs text-loss">{set.error}</p>}
      </div>
    </>
  );

  const className = cn(
    "block overflow-hidden rounded-xl border bg-surface text-left transition-[border-color,box-shadow] hover:border-border-strong",
    selected ? "border-primary ring-2 ring-primary/40" : "border-border",
  );
  return selecting ? (
    <button
      type="button"
      aria-pressed={selected}
      data-set={set.setKey}
      onClick={onToggle}
      className={cn(className, "w-full")}
    >
      {body}
    </button>
  ) : (
    <Link to="/inbox/$setKey" params={{ setKey: set.setKey }} data-set={set.setKey} className={className}>
      {body}
    </Link>
  );
}
