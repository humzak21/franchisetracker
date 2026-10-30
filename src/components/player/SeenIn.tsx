import { PLAYER_ORIGIN_LABELS, type PlayerOrigin } from "@shared/domain";

export type SeenInView = {
  origin: PlayerOrigin | null;
  createdYear: number | null;
  games: number;
  seasons: readonly { year: number; teams: readonly string[]; games: number }[];
  printed: readonly string[];
};

/** Everywhere a player has turned up, so two entries for one person can be told apart or merged. */
export function SeenIn({ seen }: { seen: SeenInView }) {
  const origin = seen.origin ? PLAYER_ORIGIN_LABELS[seen.origin] : "Origin not recorded";
  return (
    <div className="space-y-1 text-sm">
      <p>
        {origin}
        {seen.createdYear !== null && ` in ${seen.createdYear}`}
        <span className="text-muted-foreground">
          {" · "}
          <span className="num">{seen.games}</span> game{seen.games === 1 ? "" : "s"}
        </span>
      </p>
      {seen.seasons.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {seen.seasons.map((s) => (
            <li key={s.year}>
              <span className="num">{s.year}</span> {s.teams.join(", ") || "No team"}
              {s.games > 0 && <span className="num"> ({s.games})</span>}
            </li>
          ))}
        </ul>
      )}
      {seen.printed.length > 0 && (
        <p className="text-xs text-muted-foreground">Printed as {seen.printed.join(", ")}</p>
      )}
    </div>
  );
}
