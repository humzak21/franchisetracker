import { LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { isPlayoffRound, weekLabel, type WeekKey } from "@shared/domain";
import { gameFields } from "@shared/games/gameForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import {
  opponentOptions,
  toGameInput,
  WEEK_OPTIONS,
  type FormTeam,
  type GameFormInput,
  type GameFormValue,
} from "./gameFormValue";

type GameFormProps = {
  teams: readonly FormTeam[];
  userTeamId: string;
  initial: GameFormValue;
  /** Notes on a new game; an existing game's notes save from their own editor. */
  withNotes?: boolean;
  submitLabel: string;
  onSubmit: (input: GameFormInput) => Promise<unknown>;
  /** Extra controls beside the submit button (delete). */
  secondary?: ReactNode;
};

const label = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-primary)] pointer-coarse:size-5"
      />
      {children}
    </label>
  );
}

/**
 * A game's header entered by hand: week (playoff weeks are the rounds), opponent, side, final
 * score, overtime, date, stadium and weather, or a bye. The user's team is always one side.
 */
export function GameForm({
  teams,
  userTeamId,
  initial,
  withNotes,
  submitLabel,
  onSubmit,
  secondary,
}: GameFormProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof GameFormValue>(key: K, next: GameFormValue[K]) =>
    setValue((v) => ({ ...v, [key]: next }));
  const opponents = opponentOptions(teams, userTeamId);

  const submit = async () => {
    const input = toGameInput(value);
    const checked = gameFields(input, userTeamId);
    if (!checked.ok) return setError(checked.error);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(errorMessage(err, "Could not save the game."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="@container space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <label className="space-y-1.5">
          <span className={label}>Week</span>
          <Select
            aria-label="Week"
            value={value.weekKey}
            onValueChange={(w) => set("weekKey", w as WeekKey)}
            options={WEEK_OPTIONS}
          />
        </label>
        <Check checked={value.bye} onChange={(v) => set("bye", v)}>
          Bye week
        </Check>
      </div>
      {isPlayoffRound(value.weekKey) && (
        <p className="text-xs text-muted-foreground">Playoff round: {weekLabel(value.weekKey, "long")}</p>
      )}
      {!value.bye && (
        <>
          <label className="block space-y-1.5">
            <span className={label}>Opponent</span>
            <Select
              aria-label="Opponent"
              placeholder="Pick a team"
              value={value.opponentTeamId}
              onValueChange={(id) => set("opponentTeamId", id)}
              options={opponents}
            />
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Segmented
              aria-label="Side"
              value={value.userIsHome ? "home" : "away"}
              onChange={(side) => set("userIsHome", side === "home")}
              options={[
                { value: "home", label: "Home" },
                { value: "away", label: "Away" },
              ]}
            />
            <Check checked={value.neutralSite} onChange={(v) => set("neutralSite", v)}>
              Neutral site
            </Check>
          </div>
          <fieldset className="space-y-1.5">
            <legend className={label}>Final score (leave blank if not played)</legend>
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
              <Input
                aria-label="Our score"
                inputMode="numeric"
                placeholder="Us"
                value={value.us}
                onChange={(e) => set("us", e.target.value)}
                className="num"
              />
              <Input
                aria-label="Their score"
                inputMode="numeric"
                placeholder="Them"
                value={value.them}
                onChange={(e) => set("them", e.target.value)}
                className="num"
              />
              <Check checked={value.overtime} onChange={(v) => set("overtime", v)}>
                OT
              </Check>
            </div>
          </fieldset>
        </>
      )}
      <div className="grid grid-cols-1 gap-3 @tablet:grid-cols-3">
        {(
          [
            ["dateLabel", "Date", "Sun, Sep 14"],
            ["stadium", "Stadium", "Gillette Stadium"],
            ["weather", "Weather", "Clear, 61°"],
          ] as const
        ).map(([key, title, placeholder]) => (
          <label key={key} className="block space-y-1.5">
            <span className={label}>{title}</span>
            <Input
              aria-label={title}
              placeholder={placeholder}
              value={value[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      {withNotes && (
        <label className="block space-y-1.5">
          <span className={label}>Notes</span>
          <textarea
            aria-label="Notes"
            rows={3}
            value={value.notes}
            placeholder="What happened, who showed up, what to fix."
            onChange={(e) => set("notes", e.target.value)}
            className="w-full resize-y rounded-lg border border-input bg-surface px-3 py-2.5 text-[15px] leading-relaxed placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-none sm:text-sm"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {secondary}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
