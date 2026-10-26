import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Camera, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { nextWeek } from "@shared/games/summary";
import { CaptureFields, captureReady, type CaptureFieldsValue } from "@/components/forms/CaptureFields";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { currentSeason, useFranchise } from "../franchise";
import type { CapturePreset } from "./CaptureProvider";
import { useUploader } from "./useUploader";

type CaptureSheetProps = {
  open: boolean;
  preset: CapturePreset;
  initialFiles: File[];
  onClose: () => void;
  onQueued: () => void;
};

/** Pick or shoot screenshots, say what they are, and send them to the inbox. */
export function CaptureSheet({ open, preset, initialFiles, onClose, onQueued }: CaptureSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Capture"
      description="Photos of the TV or console screenshots. A box score can span several screens."
    >
      {open && (
        <CaptureForm preset={preset} initialFiles={initialFiles} onDone={onClose} onQueued={onQueued} />
      )}
    </BottomSheet>
  );
}

function CaptureForm({
  preset,
  initialFiles,
  onDone,
  onQueued,
}: {
  preset: CapturePreset;
  initialFiles: File[];
  onDone: () => void;
  onQueued: () => void;
}) {
  const active = useFranchise();
  const seasons = useMemo(() => active?.seasons ?? [], [active]);
  const navigate = useNavigate();
  const { upload } = useUploader();
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [fields, setFields] = useState<CaptureFieldsValue<Id<"seasons">>>({
    targetKey: preset.targetKey ?? "game_box_score",
    seasonId: currentSeason(seasons)?._id ?? null,
    weekKey: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  // Default the week to the one after the latest result in the chosen season.
  const schedule = useQuery(
    api.games.schedule.bySeason,
    fields.seasonId ? { seasonId: fields.seasonId } : "skip",
  );
  const suggestedWeek = useMemo(
    () =>
      schedule
        ? nextWeek(
            schedule.games.map((g) => ({
              weekKey: g.weekKey,
              status: g.status,
              // Rows are from the user's side already: "home" here is just "us".
              userIsHome: true,
              homeScore: g.us ?? undefined,
              awayScore: g.them ?? undefined,
            })),
          )
        : null,
    [schedule],
  );
  const context = { ...fields, weekKey: fields.weekKey ?? suggestedWeek };

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const add = (list: FileList | null) => setFiles((current) => [...current, ...Array.from(list ?? [])]);
  const ready = files.length > 0 && (context.targetKey === null || captureReady(context, preset.gameLabel));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await upload(files, {
        source: initialFiles.length > 0 ? "dragdrop" : "web",
        targetKey: fields.targetKey ?? undefined,
        ...(preset.gameId
          ? { gameId: preset.gameId }
          : { seasonId: context.seasonId ?? undefined, weekKey: context.weekKey ?? undefined }),
      });
      onDone();
      if (outcome.kind === "queued") onQueued();
      else if (outcome.setKeys.length === 1 && fields.targetKey) {
        void navigate({ to: "/inbox/$setKey", params: { setKey: outcome.setKeys[0] ?? "" } });
      } else void navigate({ to: "/inbox" });
    } catch (err) {
      setError(errorMessage(err, "Upload failed. Check the connection and try again."));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-2">
      <CaptureFields
        seasons={seasons}
        value={context}
        onChange={setFields}
        allowUntagged={!preset.gameId}
        game={preset.gameLabel}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" onClick={() => camera.current?.click()}>
          <Camera /> Take photo
        </Button>
        <Button variant="secondary" size="lg" onClick={() => library.current?.click()}>
          <ImagePlus /> Choose
        </Button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Take photo"
          onChange={(e) => add(e.target.files)}
        />
        <input
          ref={library}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Choose screenshots"
          onChange={(e) => add(e.target.files)}
        />
      </div>
      {files.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2" aria-label="Selected screenshots">
          {previews.map((url, i) => (
            <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border">
              <img src={url} alt={`Screenshot ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Remove screenshot ${i + 1}`}
                onClick={() => setFiles((current) => current.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white pointer-coarse:size-8"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          On the Mac you can also paste or drop screenshots anywhere in the app.
        </p>
      )}
      {error && <p className="text-sm text-loss">{error}</p>}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!ready || busy}
        onClick={() => void submit()}
      >
        {busy && <LoaderCircle className="animate-spin" />}
        {files.length === 0
          ? "Add screenshots"
          : `Upload ${files.length} screenshot${files.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
