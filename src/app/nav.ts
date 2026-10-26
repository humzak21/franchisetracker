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
  /** One line describing the screen, used by the command palette and planned-screen states. */
  description: string;
  /** Sprint that delivers the screen (docs/SPRINTS.md); planned screens show it. */
  sprint: number;
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
    sprint: 8,
    phoneTab: true,
  },
  {
    id: "schedule",
    label: "Schedule",
    to: "/schedule",
    icon: CalendarDays,
    description: "Weeks, results, three stars and game detail",
    sprint: 1,
    phoneTab: true,
  },
  {
    id: "roster",
    label: "Roster",
    to: "/roster",
    icon: Shield,
    description: "Roster, depth chart and contracts",
    sprint: 1,
    phoneTab: true,
  },
  {
    id: "players",
    label: "Players",
    to: "/players",
    icon: Users,
    description: "Players index, search, player pages and compare",
    sprint: 4,
  },
  {
    id: "stats",
    label: "Stats",
    to: "/stats",
    icon: ListOrdered,
    description: "Season stats, leaders, team stats and records",
    sprint: 3,
    phoneTab: true,
  },
  {
    id: "league",
    label: "League",
    to: "/league",
    icon: Landmark,
    description: "Standings, brackets and other teams",
    sprint: 7,
  },
  {
    id: "history",
    label: "History",
    to: "/history",
    icon: Trophy,
    description: "Decade grids, trophy room, reports and Hall of Fame",
    sprint: 1,
  },
  {
    id: "awards",
    label: "Awards",
    to: "/awards",
    icon: Medal,
    description: "Weekly and yearly awards",
    sprint: 7,
  },
  {
    id: "draft",
    label: "Draft",
    to: "/draft",
    icon: ClipboardList,
    description: "Draft history, grades and pick inventory",
    sprint: 7,
  },
  {
    id: "transactions",
    label: "Transactions",
    to: "/transactions",
    icon: ArrowLeftRight,
    description: "Signings, trades, releases and injuries",
    sprint: 7,
  },
  {
    id: "inbox",
    label: "Inbox",
    to: "/inbox",
    icon: Inbox,
    description: "Screenshots waiting for review",
    sprint: 2,
  },
  {
    id: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    description: "Franchise, thresholds, models and data",
    sprint: 2,
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
