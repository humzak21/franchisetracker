import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { INGESTION_TARGETS } from "@shared/ingestion/targets";
import { CaptureFields, captureReady, type CaptureFieldsValue } from "@/components/forms/CaptureFields";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { useSeason } from "@/app/season";
import type { WeekKey } from "@shared/domain";

type TagSheetProps = {
  setKeys: readonly string[];
  /** Total screenshots across the sets, for the title. */
  images: number;
  defaults: { seasonId: Id<"seasons"> | null; weekKey: WeekKey | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

/** Tags the selected sets with a target, season and week, which starts extraction. */
export function TagSheet({ setKeys, images, defaults, open, onOpenChange, onDone }: TagSheetProps) {
  const { seasons, season } = useSeason();
  const tag = useMutation(api.ingestion.uploads.tag);
  const [fields, setFields] = useState<CaptureFieldsValue<Id<"seasons">>>({
    targetKey: "game_box_score",
    seasonId: defaults.seasonId ?? season?._id ?? null,
    weekKey: defaults.weekKey,
  });
  const [error, setError] = useState<string | null>(null);
  const merge =
    setKeys.length > 1 && fields.targetKey !== null && INGESTION_TARGETS[fields.targetKey].multiImage;

  const submit = async () => {
    if (!fields.targetKey || !fields.seasonId || !fields.weekKey) return;
    setError(null);
    try {
      await tag({
        setKeys: [...setKeys],
        merge,
        targetKey: fields.targetKey,
        seasonId: fields.seasonId,
        weekKey: fields.weekKey,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not tag these screenshots."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Tag ${images} screenshot${images === 1 ? "" : "s"}`}
      description={merge ? "They will be read together as one game." : undefined}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!captureReady(fields)}
          onClick={() => void submit()}
        >
          Tag and extract
        </Button>
      }
    >
      <CaptureFields seasons={seasons} value={fields} onChange={setFields} />
      {error && <p className="mt-3 text-sm text-loss">{error}</p>}
    </BottomSheet>
  );
}
