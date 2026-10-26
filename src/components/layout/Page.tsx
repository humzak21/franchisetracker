import { Link } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { usePageChrome } from "./PageChrome";

type PageProps = {
  title: string;
  /** Small line above the title, e.g. "2027 season". */
  eyebrow?: ReactNode;
  /** Back target for drill-down pages. */
  back?: { to: string; label: string };
  /** Show the season switcher in the header. */
  season?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Every screen is a Page. The header is the top bar: sticky, with back navigation, the season
 * switcher, search and actions. It compacts itself on narrow screens; screens never branch on size.
 */
export function Page({ title, eyebrow, back, season = false, actions, children, className }: PageProps) {
  const chrome = usePageChrome();
  return (
    <div className="@container flex min-h-full flex-col">
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-2 px-4 @tablet:h-16 @tablet:px-6">
          {back && (
            <Button asChild variant="ghost" size="icon-sm" className="-ml-2">
              <Link to={back.to} aria-label={`Back to ${back.label}`}>
                <ChevronLeft className="size-5!" />
              </Link>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="truncate text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                {eyebrow}
              </div>
            )}
            <h1 className="truncate font-display text-2xl leading-none font-bold tracking-wide uppercase @tablet:text-[28px]">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 @tablet:gap-2">
            {actions}
            {season && chrome?.seasonSwitcher}
            {chrome && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="@desktop:hidden"
                  onClick={chrome.openSearch}
                  aria-label="Search"
                >
                  <Search className="size-[18px]!" />
                </Button>
                <button
                  type="button"
                  onClick={chrome.openSearch}
                  className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm text-subtle-foreground transition-colors hover:text-muted-foreground @desktop:flex"
                >
                  <Search className="size-4" />
                  <span className="flex-1 text-left">Search</span>
                  <Kbd>⌘K</Kbd>
                </button>
                <span className="hidden @tablet:contents">{chrome.capture}</span>
              </>
            )}
          </div>
        </div>
      </header>
      {chrome?.banner}
      <main
        className={cn(
          "mx-auto w-full max-w-[1600px] flex-1 px-4 pt-4 pb-28 @tablet:px-6 @tablet:pt-6 @tablet:pb-10",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
