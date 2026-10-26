import { Link, useRouterState } from "@tanstack/react-router";
import { Ellipsis, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { useTheme } from "@/design/theme";
import { cn } from "@/lib/cn";
import { MORE_ITEMS, PHONE_TABS, sectionOf } from "../nav";
import { NavBadge, useNavCount } from "./NavBadge";

const tabClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide uppercase";

/** Phone navigation: four primary tabs plus a More sheet holding every other screen. */
export function BottomTabBar({ onSearch }: { onSearch: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const section = useRouterState({ select: (s) => sectionOf(s.location.pathname) });
  const { resolved, toggle } = useTheme();
  const inMore = MORE_ITEMS.some((item) => item.id === section);
  const inbox = useNavCount("inbox");

  return (
    <>
      <nav
        aria-label="Main"
        className="pb-safe pl-safe pr-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl sm:hidden"
      >
        <ul className="flex">
          {PHONE_TABS.map((item) => (
            <li key={item.id} className="flex flex-1">
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className={cn(tabClass, "text-subtle-foreground data-[status=active]:text-primary")}
              >
                <item.icon className="size-[22px]" strokeWidth={2} />
                {item.label}
              </Link>
            </li>
          ))}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(tabClass, inMore ? "text-primary" : "text-subtle-foreground")}
            >
              <span className="relative">
                <Ellipsis className="size-[22px]" />
                <NavBadge dot count={inbox} className="absolute -top-0.5 -right-1" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <ul className="grid grid-cols-3 gap-2">
          {MORE_ITEMS.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="relative flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-[13px] font-medium data-[status=active]:border-primary data-[status=active]:text-primary"
              >
                <item.icon className="size-6" strokeWidth={1.75} />
                {item.label}
                {item.id === "inbox" && <NavBadge count={inbox} className="absolute top-2 right-2" />}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              onSearch();
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium"
          >
            <Search className="size-4" /> Search
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium"
          >
            {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {resolved === "dark" ? "Light theme" : "Dark theme"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
