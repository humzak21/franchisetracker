import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { Calendar, Camera, Keyboard, LayoutGrid, LogOut, Moon, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { useTheme } from "@/design/theme";
import { useCapture } from "../capture/CaptureProvider";
import { NAV_ITEMS } from "../nav";
import { useSeason } from "../season";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
};

function Item({
  onSelect,
  icon,
  children,
  hint,
}: {
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="truncate text-xs text-subtle-foreground">{hint}</span>}
    </Command.Item>
  );
}

const groupClass =
  "px-1.5 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:uppercase";

/**
 * ⌘K palette. Sprint 0 covers screens, seasons and app actions; players and games join once
 * they exist (Sprint 8 fills it out).
 */
export function CommandPalette({ open, onOpenChange, onShowShortcuts }: CommandPaletteProps) {
  const navigate = useNavigate();
  const capture = useCapture();
  const { seasons, setYear } = useSeason();
  const { toggle } = useTheme();
  const { signOut } = useAuthActions();
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Search"
        hideClose
        className="top-[max(env(safe-area-inset-top),1rem)] max-w-xl sm:top-[12vh]"
      >
        <Command loop className="flex max-h-[min(70dvh,32rem)] flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 text-subtle-foreground" />
            <Command.Input
              autoFocus
              placeholder="Search screens, seasons and actions"
              className="h-13 flex-1 bg-transparent text-base outline-none placeholder:text-subtle-foreground"
            />
            <Kbd className="max-sm:hidden">esc</Kbd>
          </div>
          <Command.List className="min-h-0 flex-1 overflow-y-auto py-1.5">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches.
            </Command.Empty>
            <Command.Group heading="Screens" className={groupClass}>
              {NAV_ITEMS.map((item) => (
                <Item
                  key={item.id}
                  icon={<item.icon />}
                  hint={item.description}
                  onSelect={run(() => navigate({ to: item.to }))}
                >
                  {item.label}
                </Item>
              ))}
            </Command.Group>
            <Command.Group heading="Seasons" className={groupClass}>
              {[...seasons].reverse().map((s) => (
                <Item key={s._id} icon={<Calendar />} hint={s.status} onSelect={run(() => setYear(s.year))}>
                  {`${s.year} season`}
                </Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className={groupClass}>
              <Item icon={<Camera />} onSelect={run(() => capture.open())}>
                Capture screenshots
              </Item>
              <Item icon={<Moon />} onSelect={run(toggle)}>
                Toggle light and dark theme
              </Item>
              <Item icon={<Keyboard />} onSelect={run(onShowShortcuts)}>
                Keyboard shortcuts
              </Item>
              <Item icon={<LayoutGrid />} onSelect={run(() => navigate({ to: "/dev/components" }))}>
                Component gallery
              </Item>
              <Item icon={<LogOut />} onSelect={run(() => void signOut())}>
                Sign out
              </Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
