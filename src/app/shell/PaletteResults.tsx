import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useQuery } from "convex/react";
import { Trophy, User } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { PaletteItem, paletteGroupClass } from "./PaletteItem";

/**
 * The palette's search groups (FEATURES.md 5.14): players matched by name on the server and games
 * by week, year or opponent. They appear once something is typed, so the empty palette stays a
 * list of screens and actions.
 */
export function PaletteResults({ search, close }: { search: string; close: (then: () => void) => void }) {
  const navigate = useNavigate();
  const text = search.trim();
  const players = useQuery(api.players.search.byName, text.length >= 2 ? { text } : "skip");
  const games = useQuery(api.games.directory.all, text.length >= 1 ? {} : "skip");

  return (
    <>
      {players && players.length > 0 && (
        <Command.Group heading="Players" className={paletteGroupClass}>
          {players.map((p) => (
            <PaletteItem
              key={p._id}
              // Names repeat across players; the id keeps each item distinct.
              value={`${p.displayName} ${p._id}`}
              keywords={[text]}
              icon={<User />}
              hint={p.position}
              onSelect={() =>
                close(() => void navigate({ to: "/players/$playerId", params: { playerId: p._id } }))
              }
            >
              {p.displayName}
            </PaletteItem>
          ))}
        </Command.Group>
      )}
      {games && games.length > 0 && (
        <Command.Group heading="Games" className={paletteGroupClass}>
          {games.map((g) => (
            <PaletteItem
              key={g._id}
              // One game per week per season, so the label is unique.
              value={`${g.year} ${weekLabel(g.weekKey, "long")} ${g.opponentAbbr}`}
              keywords={[weekLabel(g.weekKey), g.opponentName]}
              icon={<Trophy />}
              hint={
                g.result && g.us !== null && g.them !== null ? `${g.result} ${g.us}-${g.them}` : "Upcoming"
              }
              onSelect={() => close(() => void navigate({ to: "/games/$gameId", params: { gameId: g._id } }))}
            >
              {`${g.year} ${weekLabel(g.weekKey, "long")} ${g.userIsHome === false ? "at" : "vs"} ${g.opponentAbbr}`}
            </PaletteItem>
          ))}
        </Command.Group>
      )}
    </>
  );
}
