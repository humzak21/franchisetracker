import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  Calendar,
  Camera,
  Keyboard,
  Landmark,
  LayoutGrid,
  LogOut,
  Moon,
  NotebookPen,
  ScrollText,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { useTheme } from "@/design/theme";
import { useCapture } from "../capture/CaptureProvider";
import { useFranchise } from "../franchise";
import { NAV_ITEMS } from "../nav";
import { useSeason } from "../season";
import { PaletteFranchises } from "./PaletteFranchises";
import { PaletteItem, paletteGroupClass } from "./PaletteItem";
import { PaletteResults } from "./PaletteResults";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
};

/**
 * ⌘K palette (FEATURES.md 5.14): screens, seasons and actions, and once something is typed,
 * players and games; plus switching franchises. On the phone it opens from the header's search icon.
 */
export function CommandPalette({ open, onOpenChange, onShowShortcuts }: CommandPaletteProps) {
  const navigate = useNavigate();
  const capture = useCapture();
  const { seasons, season, setYear } = useSeason();
  const franchise = useFranchise();
  const { toggle } = useTheme();
  const { signOut } = useAuthActions();
  const [search, setSearch] = useState("");
  const close = (then: () => void) => {
    onOpenChange(false);
    setSearch("");
    then();
  };
  const run = (fn: () => void) => () => close(fn);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
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
              value={search}
              onValueChange={setSearch}
              placeholder="Search players, games, screens and actions"
              className="h-13 flex-1 bg-transparent text-base outline-none placeholder:text-subtle-foreground"
            />
            <Kbd className="max-sm:hidden">esc</Kbd>
          </div>
          <Command.List className="min-h-0 flex-1 overflow-y-auto py-1.5">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches.
            </Command.Empty>
            <PaletteResults search={search} close={close} />
            <Command.Group heading="Screens" className={paletteGroupClass}>
              {NAV_ITEMS.map((item) => (
                <PaletteItem
                  key={item.id}
                  icon={<item.icon />}
                  hint={item.description}
                  onSelect={run(() => navigate({ to: item.to }))}
                >
                  {item.label}
                </PaletteItem>
              ))}
            </Command.Group>
            <Command.Group heading="Seasons" className={paletteGroupClass}>
              {[...seasons].reverse().map((s) => (
                <PaletteItem
                  key={s._id}
                  icon={<Calendar />}
                  hint={s.status}
                  onSelect={run(() => setYear(s.year))}
                >
                  {`${s.year} season`}
                </PaletteItem>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className={paletteGroupClass}>
              <PaletteItem icon={<Camera />} onSelect={run(() => capture.open())}>
                Capture screenshots
              </PaletteItem>
              {season && season.year >= (franchise?.franchise.startYear ?? Infinity) && (
                <PaletteItem
                  icon={<NotebookPen />}
                  onSelect={run(() =>
                    navigate({ to: "/history/reports/$year", params: { year: String(season.year) } }),
                  )}
                >
                  {`Open the ${season.year} season report`}
                </PaletteItem>
              )}
              <PaletteItem
                icon={<Landmark />}
                onSelect={run(() => navigate({ to: "/history/hall-of-fame" }))}
              >
                Hall of Fame
              </PaletteItem>
              <PaletteItem icon={<ScrollText />} onSelect={run(() => navigate({ to: "/history/timeline" }))}>
                Timeline
              </PaletteItem>
              <PaletteItem icon={<Moon />} onSelect={run(toggle)}>
                Toggle light and dark theme
              </PaletteItem>
              <PaletteItem icon={<Keyboard />} onSelect={run(onShowShortcuts)}>
                Keyboard shortcuts
              </PaletteItem>
              <PaletteItem icon={<LayoutGrid />} onSelect={run(() => navigate({ to: "/dev/components" }))}>
                Component gallery
              </PaletteItem>
              <PaletteItem icon={<LogOut />} onSelect={run(() => void signOut())}>
                Sign out
              </PaletteItem>
            </Command.Group>
            <PaletteFranchises close={close} />
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
