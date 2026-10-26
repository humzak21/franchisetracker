import { FactChip } from "@/components/data/FactChip";
import type { Specimen } from "./specimens";

export const STATS_SPECIMENS: Specimen[] = [
  {
    id: "factchip",
    name: "FactChip",
    note: "Streaks and records held. Still-running streaks and held records light up in the team accent.",
    render: () => (
      <div className="flex flex-wrap gap-2">
        <FactChip value={5} label="Games with a TD pass" detail="Longest 5" active />
        <FactChip value={342} label="Passing yards" detail="Franchise record · single game · 2026" active />
        <FactChip value={0} label="100-yard receiving games" detail="Longest 2" />
      </div>
    ),
  },
];
