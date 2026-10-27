import { ChevronDown, ChevronUp, X } from "lucide-react";
import { moveItem } from "@shared/games/stars";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DraftStar } from "./starDraft";

type PickedStarsProps = {
  stars: DraftStar[];
  onChange: (stars: DraftStar[]) => void;
  /** Abbreviation for a star's side, when known. */
  sideOf: (star: DraftStar) => string | null;
};

/** The picked stars in order: move up or down, caption, remove. */
export function PickedStars({ stars, onChange, sideOf }: PickedStarsProps) {
  if (stars.length === 0) {
    return <p className="py-3 text-center text-sm text-muted-foreground">No stars yet. Add players below.</p>;
  }
  const move = (from: number, to: number) => onChange(moveItem(stars, from, to));
  return (
    <ol aria-label="Picked stars" className="divide-y divide-border rounded-xl border border-border">
      {stars.map((star, i) => {
        const side = sideOf(star);
        return (
          <li key={star.key} className="space-y-2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="num w-6 shrink-0 font-display text-xl font-bold text-primary">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{star.name}</span>
                <span className="block text-xs text-subtle-foreground">
                  {[star.position, side, star.playerId ? null : "typed name"].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${star.name} up`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ChevronUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${star.name} down`}
                disabled={i === stars.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ChevronDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${star.name}`}
                onClick={() => onChange(stars.filter((s) => s.key !== star.key))}
              >
                <X />
              </Button>
            </div>
            <Input
              aria-label={`Caption for ${star.name}`}
              placeholder="Caption (optional): 22/30, 284 yds, 3 TD"
              value={star.caption}
              maxLength={120}
              onChange={(e) =>
                onChange(stars.map((s) => (s.key === star.key ? { ...s, caption: e.target.value } : s)))
              }
            />
          </li>
        );
      })}
    </ol>
  );
}
