import { Check, Copy, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

/** Copies text and says so for a moment. `text` is read on the click, so a URL is the current one. */
export function CopyButton({
  text,
  label,
  icon: Icon = Copy,
}: {
  text: string | (() => string);
  label: string;
  icon?: LucideIcon;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(typeof text === "string" ? text : text()).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  return (
    <Button size="sm" variant="outline" aria-label={copied ? "Copied" : label} onClick={() => void copy()}>
      {copied ? <Check /> : <Icon />} <span className="max-sm:sr-only">{copied ? "Copied" : label}</span>
    </Button>
  );
}
