import { formatSchemes, STAFF_FIELDS, type CoachingStaff } from "@shared/domain";
import { cn } from "@/lib/cn";

const PEOPLE = STAFF_FIELDS.filter((f) => !f.key.endsWith("Scheme"));

/**
 * A season's coaching staff and schemes on one wrapping line ("HC Mike Vrabel · OC … · West
 * Coast / 4-3"): the season header, the dashboard season card and the decade grid's cards.
 */
export function StaffLine({
  staff,
  empty,
  className,
}: {
  staff: CoachingStaff | undefined;
  /** Shown when nothing is set; nothing renders without it. */
  empty?: string;
  className?: string;
}) {
  const people = PEOPLE.flatMap(({ key, short }) => (staff?.[key] ? [{ short, name: staff[key] }] : []));
  const schemes = formatSchemes(staff);
  if (people.length === 0 && !schemes) {
    return empty ? <p className={cn("text-sm text-subtle-foreground", className)}>{empty}</p> : null;
  }
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground", className)}>
      {people.map(({ short, name }) => (
        <span key={short} className="whitespace-nowrap">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            {short}
          </span>{" "}
          <span className="text-foreground">{name}</span>
        </span>
      ))}
      {schemes && <span className="whitespace-nowrap">{schemes}</span>}
    </p>
  );
}
