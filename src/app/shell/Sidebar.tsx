import { Link } from "@tanstack/react-router";
import { ChevronsUpDown, Moon, Sun } from "lucide-react";
import { useState, type ReactElement } from "react";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/design/theme";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useFranchise } from "../franchise";
import { NAV_ITEMS, navItem } from "../nav";
import { FranchiseList } from "./FranchiseList";
import { NavBadge, useNavCount } from "./NavBadge";

const SettingsIcon = navItem("settings").icon;
const RAIL_ITEMS = NAV_ITEMS.filter((n) => n.id !== "settings");

/**
 * Team-colored sidebar. Icon rail on tablets (640 to 1024 px), full labels on desktop.
 * Hidden on phones, where the bottom tab bar takes over.
 */
export function Sidebar() {
  const inbox = useNavCount("inbox");
  const { resolved, toggle } = useTheme();
  // Labels are visible on desktop; the icon rail needs tooltips.
  const rail = !useMediaQuery(DESKTOP_QUERY);

  return (
    <nav
      aria-label="Main"
      className="pt-safe pl-safe sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col bg-team text-team-foreground sm:flex lg:w-60"
      style={{ backgroundImage: "linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(0 0 0 / 0.22))" }}
    >
      <FranchiseSwitcher />
      <ul className="flex-1 scrollbar-none space-y-0.5 overflow-y-auto px-3 py-2">
        {RAIL_ITEMS.map((item) => (
          <li key={item.id}>
            <MaybeTooltip label={rail ? item.label : null}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium opacity-75 transition-[background-color,opacity] hover:bg-white/10 hover:opacity-100 data-[status=active]:bg-white/15 data-[status=active]:opacity-100 data-[status=active]:shadow-[inset_3px_0_0_var(--team-secondary)] max-lg:justify-center max-lg:px-0"
              >
                <span className="relative">
                  <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
                  {item.id === "inbox" && (
                    <NavBadge dot count={inbox} className="absolute -top-0.5 -right-1 lg:hidden" />
                  )}
                </span>
                <span className="hidden lg:inline">{item.label}</span>
                {item.id === "inbox" && <NavBadge count={inbox} className="ml-auto hidden lg:inline" />}
              </Link>
            </MaybeTooltip>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1 border-t border-white/10 p-3 max-lg:flex-col">
        <Link
          to="/settings"
          className="flex h-10 flex-1 items-center gap-3 rounded-lg px-3 text-sm font-medium opacity-75 hover:bg-white/10 hover:opacity-100 data-[status=active]:bg-white/15 data-[status=active]:opacity-100 max-lg:w-full max-lg:justify-center max-lg:px-0"
        >
          <SettingsIcon className="size-[18px] shrink-0" />
          <span className="hidden lg:inline">Settings</span>
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}
          className="grid size-10 place-items-center rounded-lg opacity-75 hover:bg-white/10 hover:opacity-100"
        >
          {resolved === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
      </div>
    </nav>
  );
}

function MaybeTooltip({ label, children }: { label: string | null; children: ReactElement }) {
  return label ? (
    <Tooltip content={label} side="right">
      {children}
    </Tooltip>
  ) : (
    children
  );
}

/** The franchise header: its logo and name, opening the list of franchises to switch between. */
function FranchiseSwitcher() {
  const active = useFranchise();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${active?.franchise.name ?? "Franchise"}: switch franchise`}
        className="mx-2 mt-2 flex h-14 items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-white/10 data-[state=open]:bg-white/15 max-lg:justify-center lg:px-3"
      >
        {active ? (
          <TeamLogo team={active.userTeam} size="sm" className="ring-1 ring-white/20" />
        ) : (
          <div className="size-7 rounded-lg bg-white/10" />
        )}
        <div className="hidden min-w-0 flex-1 lg:block">
          <div className="truncate font-display text-lg leading-none font-bold tracking-wide uppercase">
            {active?.franchise.name ?? "FranchiseTracker"}
          </div>
          <div className="mt-0.5 truncate text-[11px] opacity-60">
            {active ? `${active.userTeam.city} ${active.userTeam.name}` : " "}
          </div>
        </div>
        <ChevronsUpDown className="hidden size-4 shrink-0 opacity-60 lg:block" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80">
        <div className="mb-2 px-2.5 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          Franchises
        </div>
        <FranchiseList onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
