import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A checkbox for picking rows (compare, a batch move). A button, so a click on it never also
 * opens the row it sits in; `mixed` shows a partial selection on a select-all box.
 */
export function SelectBox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean | "mixed";
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(checked !== true);
      }}
      className={cn(
        // A 44 px hit area on touch screens, inside a table or not (a select-all box sits outside one).
        "grid size-5 shrink-0 place-items-center rounded border transition-colors disabled:opacity-30 pointer-coarse:touch-target pointer-coarse:size-7",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
        className,
      )}
    >
      {checked === true && <Check className="size-3.5" />}
      {checked === "mixed" && <Minus className="size-3.5" />}
    </button>
  );
}
