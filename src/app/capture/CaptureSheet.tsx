import { useNavigate } from "@tanstack/react-router";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { INGESTION_TARGETS, suggestedWeek } from "@shared/ingestion/targets";
import { CaptureFields, captureReady, type CaptureFieldsValue } from "@/components/forms/CaptureFields";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { currentSeason, useFranchise } from "../franchise";
import type { CapturePreset } from "./CaptureProvider";
import { InboxPicker } from "./InboxPicker";
import { SelectedShots } from "./SelectedShots";
import { useAttachToGame } from "./useAttachToGame";
import { useUploader } from "./useUploader";
import { useQuery } from "@/lib/convex/useQuery";

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
  const attach = useAttachToGame();
  const [files, setFiles] = useState<File[]>(initialFiles);
  // Inbox sets picked for this game (only offered when the sheet was opened from a game).
  const [picked, setPicked] = useState<string[]>([]);
  const [fields, setFields] = useState<CaptureFieldsValue<Id<"seasons">>>({
    targetKey: preset.targetKey ?? "game_log",
    seasonId: currentSeason(seasons)?._id ?? null,
    weekKey: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  // Default the week from the schedule: the next game for a game screen, the week just played for a weekly one.
  const schedule = useQuery(
    api.games.schedule.bySeason,
    fields.seasonId ? { seasonId: fields.seasonId } : "skip",
  );
  const games = useMemo(
    () =>
      (schedule?.games ?? []).map((g) => ({
        weekKey: g.weekKey,
        status: g.status,
        // Rows are from the user's side already: "home" here is just "us".
        userIsHome: true,
        homeScore: g.us ?? undefined,
        awayScore: g.them ?? undefined,
      })),
    [schedule],
  );
  const suggested = schedule && fields.targetKey ? suggestedWeek(fields.targetKey, games) : null;
  const seasonScreen = fields.targetKey !== null && INGESTION_TARGETS[fields.targetKey].scope === "season";
  const context = { ...fields, weekKey: seasonScreen ? null : (fields.weekKey ?? suggested) };

  const add = (list: FileList | null) => setFiles((current) => [...current, ...Array.from(list ?? [])]);
  const chosen = files.length + picked.length;
  const ready = chosen > 0 && (context.targetKey === null || captureReady(context, preset.gameLabel));
  const source = initialFiles.length > 0 ? "dragdrop" : "web";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (preset.gameId && fields.targetKey && picked.length > 0) {
        const setKey = await attach({
          gameId: preset.gameId,
          targetKey: fields.targetKey,
          setKeys: picked,
          files,
          source,
        });
        onDone();
        void navigate({ to: "/inbox/$setKey", params: { setKey } });
        return;
      }
      const outcome = await upload(files, {
        source,
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
      <SelectedShots
        files={files}
        onRemove={(i) => setFiles((current) => current.filter((_, j) => j !== i))}
      />
      {preset.gameId && <InboxPicker selected={picked} onChange={setPicked} />}
      {error && <p className="text-sm text-loss">{error}</p>}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!ready || busy}
        onClick={() => void submit()}
      >
        {busy && <LoaderCircle className="animate-spin" />}
        {chosen === 0
          ? "Add screenshots"
          : picked.length > 0
            ? `Attach to this game (${picked.length} from inbox${files.length > 0 ? `, ${files.length} new` : ""})`
            : `Upload ${files.length} screenshot${files.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
