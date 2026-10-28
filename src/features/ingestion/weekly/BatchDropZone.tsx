import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { imageFiles } from "@/lib/image";

/**
 * Where the batch's screenshots go in: chosen from the device or dropped here. The drop stops
 * here, so the app-wide capture sheet does not open as well.
 */
export function BatchDropZone({
  onFiles,
  progress,
}: {
  onFiles: (files: File[]) => void;
  progress: { done: number; total: number } | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const stop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div
      onDragOver={(e) => {
        stop(e);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        onFiles(imageFiles(e.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        over ? "border-primary bg-elite-1" : "border-border-strong bg-surface",
      )}
    >
      {progress ? (
        <p className="num flex items-center gap-2 text-sm font-medium">
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          Uploading {progress.done} of {progress.total}
        </p>
      ) : (
        <>
          <ImagePlus className="size-7 text-subtle-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Drop every week's awards screen here</p>
            <p className="text-sm text-muted-foreground">
              All 18 at once is fine. Match each to its week afterwards, then read them together.
            </p>
          </div>
          <Button variant="primary" onClick={() => input.current?.click()}>
            Choose screenshots
          </Button>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Weekly awards screenshots"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
