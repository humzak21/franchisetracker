import type { ReactNode } from "react";
import { NFL_TEAMS } from "@shared/domain";
import { ThemeScope, useTheme } from "@/design/theme";
import { Page } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { SPECIMENS, type Specimen } from "./specimens";

type ThemeChoice = "app" | "dark" | "light" | "both";

const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 960;

type FrameProps = {
  label: string;
  width: number;
  fluid?: boolean;
  theme: "dark" | "light";
  team: (typeof NFL_TEAMS)[number];
  children: ReactNode;
};

/** A themed box of a given content width. `fluid` frames shrink to fit (the phone frame on a real phone). */
function Frame({ label, width, fluid, theme, team, children }: FrameProps) {
  return (
    <figure className={fluid ? "w-full max-w-fit min-w-0 shrink-0" : "min-w-0"}>
      <figcaption className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {label} · {width}px · {theme}
      </figcaption>
      <div className="overflow-x-auto rounded-xl border border-border-strong" data-swipe-ignore>
        <ThemeScope theme={theme} team={team} className="p-4">
          <div style={fluid ? { width, maxWidth: "100%" } : { width }}>{children}</div>
        </ThemeScope>
      </div>
    </figure>
  );
}

function SpecimenBlock({
  specimen,
  themes,
  team,
}: {
  specimen: Specimen;
  themes: ("dark" | "light")[];
  team: (typeof NFL_TEAMS)[number];
}) {
  return (
    <section id={specimen.id} className="scroll-mt-24 border-t border-border pt-6">
      <h2 className="font-display text-2xl font-bold tracking-wide uppercase">{specimen.name}</h2>
      {specimen.note && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{specimen.note}</p>}
      <div className="mt-4 space-y-5">
        {themes.map((theme) => (
          <div key={theme} className="flex flex-col gap-5 2xl:flex-row">
            <Frame label="Phone" width={PHONE_WIDTH} fluid theme={theme} team={team}>
              {specimen.render()}
            </Frame>
            <Frame label="Desktop" width={DESKTOP_WIDTH} theme={theme} team={team}>
              {specimen.render()}
            </Frame>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * /dev/components: every primitive at phone and desktop width, in either or both themes, under
 * any team's colors. Components switch layout on their own width, so the phone frame is honest.
 */
export function GalleryScreen() {
  const { resolved } = useTheme();
  const [choice, setChoice] = useLocalStorage<ThemeChoice>("ft.gallery.theme", "both");
  const [teamAbbr, setTeamAbbr] = useLocalStorage("ft.gallery.team", "NE");
  const team = NFL_TEAMS.find((t) => t.abbr === teamAbbr) ?? NFL_TEAMS[0]!;
  const themes: ("dark" | "light")[] =
    choice === "both" ? ["dark", "light"] : [choice === "app" ? resolved : choice];

  return (
    <Page title="Component gallery" eyebrow="Developer">
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6">
        <Segmented
          size="sm"
          value={choice}
          onChange={setChoice}
          aria-label="Theme"
          options={[
            { value: "both", label: "Both" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "app", label: "App" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="max-sm:sr-only">Team</span>
          <select
            value={teamAbbr}
            onChange={(e) => setTeamAbbr(e.target.value)}
            className="h-8 max-w-40 rounded-lg border border-input bg-surface px-2 text-sm text-foreground pointer-coarse:h-10"
          >
            {NFL_TEAMS.map((t) => (
              <option key={t.abbr} value={t.abbr}>
                {t.city} {t.name}
              </option>
            ))}
          </select>
        </label>
        <nav
          aria-label="Specimens"
          className="flex w-full scrollbar-none gap-1.5 overflow-x-auto"
          data-swipe-ignore
        >
          {SPECIMENS.map((sp) => (
            <a
              key={sp.id}
              href={`#${sp.id}`}
              className="shrink-0 rounded-full border border-border px-3 py-1 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground"
            >
              {sp.name}
            </a>
          ))}
        </nav>
      </div>
      <div className="space-y-10">
        {SPECIMENS.map((sp) => (
          <SpecimenBlock key={sp.id} specimen={sp} themes={themes} team={team} />
        ))}
      </div>
    </Page>
  );
}
