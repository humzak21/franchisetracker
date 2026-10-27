import { UserPlus } from "lucide-react";
import { useState } from "react";
import { POSITIONS, type Position } from "@shared/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { parseWhole, type Person } from "./moveForm";

const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: p }));

/** A player not in the app yet: name and position, with age and OVR if known. Saving the move creates them. */
export function NewPersonFields({ label, onAdd }: { label: string; onAdd: (person: Person) => void }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("QB");
  const [age, setAge] = useState("");
  const [ovr, setOvr] = useState("");
  const trimmed = name.trim();
  const add = () => {
    if (trimmed.length < 2) return;
    onAdd({ kind: "new", name: trimmed, position, age: parseWhole(age), ovr: parseWhole(ovr) });
    setName("");
    setAge("");
    setOvr("");
  };
  return (
    <div className="space-y-2">
      <Input
        aria-label={`${label}: new player name`}
        placeholder="Full name"
        value={name}
        maxLength={60}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        <Select
          aria-label={`${label}: position`}
          value={position}
          options={POSITION_OPTIONS}
          onValueChange={(p) => setPosition(p as Position)}
        />
        <Input
          aria-label={`${label}: age`}
          placeholder="Age"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
        />
        <Input
          aria-label={`${label}: OVR`}
          placeholder="OVR"
          inputMode="numeric"
          value={ovr}
          onChange={(e) => setOvr(e.target.value.replace(/\D/g, "").slice(0, 2))}
        />
      </div>
      <Button size="sm" variant="outline" disabled={trimmed.length < 2} onClick={add} className="w-full">
        <UserPlus /> Add {trimmed || "new player"}
      </Button>
    </div>
  );
}
