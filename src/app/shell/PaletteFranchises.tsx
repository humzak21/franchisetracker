import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useQuery } from "convex/react";
import { Plus, Repeat } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useSwitchFranchise } from "../franchise";
import { PaletteItem, paletteGroupClass } from "./PaletteItem";

/** Switching to another franchise, or starting a new one, from the palette. */
export function PaletteFranchises({ close }: { close: (then: () => void) => void }) {
  const navigate = useNavigate();
  const switchTo = useSwitchFranchise();
  const franchises = useQuery(api.franchise.franchises.list, {});
  return (
    <Command.Group heading="Franchises" className={paletteGroupClass}>
      {franchises
        ?.filter((f) => !f.isActive && !f.deleting)
        .map((f) => (
          <PaletteItem
            key={f._id}
            icon={<Repeat />}
            hint={`${f.userTeam.city} ${f.userTeam.name}`}
            onSelect={() => close(() => void switchTo(f._id))}
          >
            {`Switch to ${f.name}`}
          </PaletteItem>
        ))}
      <PaletteItem icon={<Plus />} onSelect={() => close(() => void navigate({ to: "/franchises/new" }))}>
        New franchise
      </PaletteItem>
    </Command.Group>
  );
}
