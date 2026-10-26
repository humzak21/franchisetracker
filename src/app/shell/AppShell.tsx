import { Outlet, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageChromeProvider } from "@/components/layout/PageChrome";
import { useTheme } from "@/design/theme";
import { useShortcut } from "../keyboard";
import { useSeason } from "../season";
import { BottomTabBar } from "./BottomTabBar";
import { CaptureButton, CaptureFab } from "./CaptureButton";
import { CommandPalette } from "./CommandPalette";
import { SeasonSwitcher } from "./SeasonSwitcher";
import { ShortcutSheet } from "./ShortcutSheet";
import { Sidebar } from "./Sidebar";

/** Sidebar on tablet and desktop; tab bar, More sheet and capture FAB on phones. */
export function AppShell() {
  const navigate = useNavigate();
  const { setPickerOpen } = useSeason();
  const { toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useShortcut("palette", {
    key: "k",
    mod: true,
    label: "Search",
    touch: "Search icon",
    handler: () => setPaletteOpen((o) => !o),
  });
  useShortcut("palette-slash", { key: "/", label: "Search", handler: () => setPaletteOpen(true) });
  useShortcut("season", {
    key: "s",
    label: "Switch season",
    touch: "Season button in the header",
    handler: () => setPickerOpen(true),
  });
  useShortcut("inbox", {
    key: "i",
    label: "Open the inbox",
    touch: "Capture button",
    handler: () => navigate({ to: "/inbox" }),
  });
  useShortcut("theme", { key: "t", label: "Toggle theme", touch: "More sheet", handler: toggle });
  useShortcut("help", { key: "?", label: "Show shortcuts", handler: () => setShortcutsOpen(true) });

  const chrome = useMemo(
    () => ({
      seasonSwitcher: <SeasonSwitcher />,
      openSearch: () => setPaletteOpen(true),
      capture: <CaptureButton />,
    }),
    [],
  );

  return (
    <PageChromeProvider value={chrome}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="pr-safe max-sm:pl-safe min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
      <BottomTabBar onSearch={() => setPaletteOpen(true)} />
      <CaptureFab />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </PageChromeProvider>
  );
}
