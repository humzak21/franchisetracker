import { cloneElement, useId, type ReactElement } from "react";
import { cn } from "@/lib/cn";

/**
 * A labelled form control in the move sheets. The label points at the control by id rather than
 * wrapping it: a label around a native select would read every option as part of its name.
 */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("block min-w-0 space-y-1", className)}>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase"
      >
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
