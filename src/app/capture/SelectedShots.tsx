import { X } from "lucide-react";
import { useEffect, useMemo } from "react";

/** Thumbnails of the screenshots picked or shot on this device, each removable. */
export function SelectedShots({
  files,
  onRemove,
}: {
  files: readonly File[];
  onRemove: (index: number) => void;
}) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  if (files.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        On the Mac you can also paste or drop screenshots anywhere in the app.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-4 gap-2" aria-label="Selected screenshots">
      {previews.map((url, i) => (
        <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border">
          <img src={url} alt={`Screenshot ${i + 1}`} className="size-full object-cover" />
          <button
            type="button"
            aria-label={`Remove screenshot ${i + 1}`}
            onClick={() => onRemove(i)}
            className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white pointer-coarse:size-8"
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
