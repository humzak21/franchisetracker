import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { useShortcutList } from "../keyboard";

/** The `?` sheet: every registered shortcut and its touch equivalent. */
export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const shortcuts = useShortcutList();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Keyboard shortcuts"
        description="On the phone, the same actions are reachable by touch."
      >
        <ul className="divide-y divide-border px-5 pt-3 pb-5">
          {shortcuts.map((s) => (
            <li key={`${s.mod ? "mod+" : ""}${s.key}`} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex-1">{s.label}</span>
              {s.touch && <span className="text-xs text-subtle-foreground">{s.touch}</span>}
              <span className="flex gap-1">
                {s.mod && <Kbd>⌘</Kbd>}
                <Kbd>{s.key.toUpperCase()}</Kbd>
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
