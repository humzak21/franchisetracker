import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { parseStat } from "./draftEdit";

export type FieldFlag = "error" | "warning" | "doubt" | null;

type NumberFieldProps = {
  label: string;
  value: number | null | undefined;
  /** `undefined` when cleared. */
  onChange: (value: number | undefined) => void;
  flag?: FieldFlag;
  /** Pace values like time of possession are typed as text and parsed by the caller. */
  format?: (value: number) => string;
  parse?: (text: string) => number | undefined | null;
  className?: string;
  readOnly?: boolean;
};

const flagClass: Record<Exclude<FieldFlag, null>, string> = {
  error: "border-loss bg-loss/10",
  warning: "border-warn bg-warn/10",
  doubt: "border-warn/60",
};

/**
 * A labelled number for review: numeric keyboard on phones, commits on every valid keystroke,
 * and outlined when validation or the model's confidence flags it.
 */
export function NumberField({
  label,
  value,
  onChange,
  flag = null,
  format,
  parse,
  className,
  readOnly = false,
}: NumberFieldProps) {
  const id = useId();
  const show = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : format ? format(v) : String(v);
  const [text, setText] = useState(show(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(show(value));
    // `show` is rebuilt every render; only an outside change of value should resync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="block truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </label>
      <input
        id={id}
        readOnly={readOnly}
        inputMode={format ? "text" : "decimal"}
        autoComplete="off"
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(show(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const next = (parse ?? parseStat)(e.target.value);
          if (next !== null) onChange(next);
        }}
        className={cn(
          "num mt-0.5 h-9 w-full rounded-lg border border-input bg-surface px-2.5 text-right text-sm font-semibold focus-visible:border-primary focus-visible:outline-none pointer-coarse:h-11 pointer-coarse:text-base",
          flag && flagClass[flag],
        )}
      />
    </div>
  );
}
