import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** One search for a page of stat tables: it narrows every table at once. */
export function FindPlayer({
  value,
  onChange,
  placeholder = "Find a player",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
