import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { POSITIONS, type Position } from "@shared/domain";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

/**
 * The lightweight draft board (FEATURES.md 5.9): the needs the last season's report named, the
 * prospects you noted in your order, and who the team took.
 */
export function BoardView({ year }: { year: number }) {
  const board = useQuery(api.draft.board.get, { year });
  const add = useMutation(api.draft.board.addProspect);
  const move = useMutation(api.draft.board.moveProspect);
  const remove = useMutation(api.draft.board.removeProspect);
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("QB");
  const [college, setCollege] = useState("");
  if (board === undefined) return <Skeleton className="h-48 rounded-xl" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await add({ year, name, position, college: college || undefined });
    setName("");
    setCollege("");
  };

  return (
    <div className="@container grid gap-6 @desktop:grid-cols-[1fr_2fr_1fr]">
      <Section title="Needs" description={`From the ${year - 1} season report.`}>
        {board.needs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No needs written for this offseason.</p>
        ) : (
          <ul className="space-y-1.5">
            {board.needs.map((n, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  !n.open && "text-muted-foreground line-through",
                )}
              >
                <PositionBadge position={n.position} />
                <span className="min-w-0 flex-1 truncate">{n.note ?? `${n.position} help`}</span>
                <Badge tone={n.priority === "high" ? "loss" : n.priority === "medium" ? "warn" : "neutral"}>
                  {n.priority}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Prospects" description="Your order. Move them up and down as the draft nears.">
        <form onSubmit={submit} className="mb-3 flex flex-wrap gap-2">
          <Input
            aria-label="Prospect"
            placeholder="Name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="min-w-40 flex-1"
          />
          <Select
            aria-label="Prospect position"
            className="w-24"
            value={position}
            onValueChange={(p) => setPosition(p as Position)}
            options={POSITIONS.map((p) => ({ value: p, label: p }))}
          />
          <Input
            aria-label="College"
            placeholder="College"
            value={college}
            maxLength={60}
            onChange={(e) => setCollege(e.target.value)}
            className="w-36"
          />
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            <Plus /> Add
          </Button>
        </form>
        {board.prospects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prospects yet.</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
            {board.prospects.map((p, i) => (
              <li key={p._id} className="flex min-h-12 items-center gap-2 px-3">
                <span className="num w-6 text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <PositionBadge position={p.position} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  {p.college && (
                    <span className="block truncate text-xs text-muted-foreground">{p.college}</span>
                  )}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${p.name} up`}
                  disabled={i === 0}
                  onClick={() => void move({ id: p._id, direction: -1 })}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${p.name} down`}
                  disabled={i === board.prospects.length - 1}
                  onClick={() => void move({ id: p._id, direction: 1 })}
                >
                  <ArrowDown />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => void remove({ id: p._id })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Taken" description="Who the team drafted.">
        {board.taken.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not drafted yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {board.taken.map((p) => (
              <li key={p.overall} className="flex items-center gap-2 text-sm">
                <span className="num w-10 text-xs text-muted-foreground">#{p.overall}</span>
                {p.position && <PositionBadge position={p.position} />}
                <span className="min-w-0 truncate font-medium">{p.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
