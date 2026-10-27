import { GoalLine } from "@/components/data/GoalLine";
import type { Specimen } from "./specimens";

export const GOAL_SPECIMENS: Specimen[] = [
  {
    id: "goalline",
    name: "GoalLine",
    note: "Pre-season goals on the report, Home and Stats. Hit goals light up in the win color; a lower-is-better limit fills toward the line.",
    render: () => (
      <div className="space-y-2">
        <GoalLine
          goal={{ type: "wins", target: 11 }}
          evaluation={{ status: "in_progress", progress: { current: 7, target: 11, better: "higher" } }}
        />
        <GoalLine goal={{ type: "playoffs" }} evaluation={{ status: "hit", progress: null }} />
        <GoalLine
          goal={{ type: "stat", statKey: "passYds", target: 4500 }}
          evaluation={{ status: "hit", progress: { current: 4612, target: 4500, better: "higher" } }}
          player={{ _id: "maye", displayName: "Drake Maye", position: "QB" }}
        />
        <GoalLine
          goal={{ type: "stat", statKey: "passInt", target: 8 }}
          evaluation={{
            status: "in_progress",
            onTrack: true,
            progress: { current: 5, target: 8, better: "lower" },
          }}
        />
        <GoalLine goal={{ type: "super_bowl_win" }} evaluation={{ status: "missed", progress: null }} />
        <GoalLine
          goal={{ type: "custom", text: "Beat Buffalo twice" }}
          evaluation={{ status: "hit", manual: true, progress: null }}
        />
        <GoalLine
          goal={{ type: "custom", text: "Sweep the division" }}
          evaluation={{ status: "pending", progress: null }}
        />
      </div>
    ),
  },
];
