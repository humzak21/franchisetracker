import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** The box score's one-click star: filled for a star of the game, outlined for everyone else. */
export function StarToggle({
  name,
  starred,
  busy,
  onToggle,
}: {
  name: string;
  starred: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={starred}
      aria-label={starred ? `Remove ${name} from the stars` : `Make ${name} a star`}
      title={starred ? "Star of the game (click to remove)" : "Make a star of the game"}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="size-7 shrink-0"
    >
      <Star className={cn(starred ? "fill-current text-primary" : "text-subtle-foreground")} />
    </Button>
  );
}
