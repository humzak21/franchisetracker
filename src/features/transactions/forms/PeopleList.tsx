import { X } from "lucide-react";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Badge } from "@/components/ui/misc";
import { personKey, type Person } from "./moveForm";

/** The players chosen for a move, each removable; new players are marked so the owner knows a record is created. */
export function PeopleList({
  people,
  onRemove,
}: {
  people: readonly Person[];
  onRemove: (person: Person) => void;
}) {
  if (people.length === 0) return null;
  return (
    <ul className="space-y-1">
      {people.map((p) => (
        <li
          key={personKey(p)}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-surface-2 pr-1 pl-2.5"
        >
          {p.position && <PositionBadge position={p.position} />}
          <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
          {p.kind === "new" && <Badge tone="accent">New</Badge>}
          <button
            type="button"
            aria-label={`Remove ${p.name}`}
            onClick={() => onRemove(p)}
            className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground pointer-coarse:size-11"
          >
            <X className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
