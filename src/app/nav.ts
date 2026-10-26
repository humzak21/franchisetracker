import {
  ArrowLeftRight,
  CalendarDays,
  ClipboardList,
  House,
  Inbox,
  Landmark,
  ListOrdered,
  Medal,
  Settings,
  Shield,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** One line describing the screen, used by the command palette. */
  description: string;
  /** Shown in the phone bottom tab bar; everything else lives in the More sheet. */
  phoneTab?: boolean;
};

/** Single source for the sidebar, the phone tab bar, the More sheet and the command palette. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "home",
    label: "Home",
    to: "/",
    icon: House,
    description: "Season at a glance, prompts and milestones",
    phoneTab: true,
  },
  {
    id: "schedule",
    label: "Schedule",
    to: "/schedule",
    icon: CalendarDays,
    description: "Weeks, results, three stars and game detail",
    phoneTab: true,
  },
  {
    id: "roster",
    label: "Roster",
    to: "/roster",
    icon: Shield,
    description: "Roster, depth chart and contracts",
    phoneTab: true,
  },
  {
    id: "players",
    label: "Players",
    to: "/players",
    icon: Users,
    description: "Players index, search, player pages and compare",
  },
  {
    id: "stats",
    label: "Stats",
    to: "/stats",
    icon: ListOrdered,
    description: "Season stats, leaders, team stats and records",
    phoneTab: true,
  },
  {
    id: "league",
    label: "League",
    to: "/league",
    icon: Landmark,
    description: "Standings, brackets and other teams",
  },
  {
    id: "history",
    label: "History",
    to: "/history",
    icon: Trophy,
    description: "Decade grids, trophy room, reports and Hall of Fame",
  },
  {
    id: "awards",
    label: "Awards",
    to: "/awards",
    icon: Medal,
    description: "Weekly and yearly awards",
  },
  {
    id: "draft",
    label: "Draft",
    to: "/draft",
    icon: ClipboardList,
    description: "Draft history, grades and pick inventory",
  },
  {
    id: "transactions",
    label: "Transactions",
    to: "/transactions",
    icon: ArrowLeftRight,
    description: "Signings, trades, releases and injuries",
  },
  {
    id: "inbox",
    label: "Inbox",
    to: "/inbox",
    icon: Inbox,
    description: "Screenshots waiting for review",
  },
  {
    id: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    description: "Franchise, thresholds, models and data",
  },
];

export const PHONE_TABS = NAV_ITEMS.filter((item) => item.phoneTab);
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.phoneTab);

export function navItem(id: string): NavItem {
  const item = NAV_ITEMS.find((n) => n.id === id);
  if (!item) throw new Error(`Unknown nav item "${id}"`);
  return item;
}

/** The nav section a path belongs to ("/schedule/2027/w3" → "schedule"). */
export function sectionOf(pathname: string): string {
  const segment = pathname.split("/")[1] ?? "";
  return segment === "" ? "home" : segment;
}
