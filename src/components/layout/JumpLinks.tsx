import { cn } from "@/lib/cn";

export type JumpLink = { id: string; label: string };

/**
 * Section jump links for long pages: a row of chips that sticks under the page header and
 * scrolls sideways when it runs out of room, so a phone can hop between sections of a page.
 */
export function JumpLinks({ links, className }: { links: readonly JumpLink[]; className?: string }) {
  return (
    <nav
      aria-label="On this page"
      data-swipe-ignore
      className={cn(
        "sticky top-14 z-20 -mx-4 flex scrollbar-none gap-1.5 overflow-x-auto border-b border-border bg-background/90 px-4 py-2 backdrop-blur @tablet:top-16 @tablet:-mx-6 @tablet:px-6",
        className,
      )}
    >
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className="flex h-8 shrink-0 items-center rounded-full border border-border px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground pointer-coarse:h-11"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
