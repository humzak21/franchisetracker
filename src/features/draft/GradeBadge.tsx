import { Badge, type BadgeProps } from "@/components/ui/misc";

const TONE: Record<string, BadgeProps["tone"]> = {
  A: "win",
  B: "accent",
  C: "neutral",
  D: "warn",
  F: "loss",
};

/** A hindsight grade (A to F, with the score as a tooltip); nothing until the pick can be judged. */
export function GradeBadge({ grade }: { grade: { score: number; letter: string } | null }) {
  if (!grade) return null;
  return (
    <Badge
      tone={TONE[grade.letter] ?? "neutral"}
      title={`Retrospective grade: ${grade.score} of 100`}
      className="num"
    >
      {grade.letter}
    </Badge>
  );
}
