import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type ViewerImage = { id: string; src: string | null; alt: string };

type ImageViewerProps = {
  images: readonly ViewerImage[];
  className?: string;
};

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(1, s));

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Screenshot viewer for review: pinch or ctrl-scroll to zoom, drag to pan, double-tap to jump
 * in and back out, thumbnails to switch between the screens of a set. Swiping between panes is
 * suspended while zoomed so a pan never changes pane.
 */
export function ImageViewer({ images, className }: ImageViewerProps) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoomTo = (next: number) => {
    const s = clampScale(next);
    setScale(s);
    if (s === 1) setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    // Trackpad pinch arrives as ctrl+wheel; plain wheel pans once zoomed in.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setScale((s) => clampScale(s * Math.exp(-e.deltaY / 100)));
      } else if (scale > 1) {
        e.preventDefault();
        setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale]);

  const down = (e: ReactPointerEvent) => {
    // The zoom buttons sit inside the frame; capturing their pointer would swallow the click.
    if (e.target instanceof Element && e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pointers.current.values()];
    if (a && b) pinch.current = { distance: distance(a, b), scale };
  };
  const move = (e: ReactPointerEvent) => {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    const current = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, current);
    const [a, b] = [...pointers.current.values()];
    if (a && b && pinch.current) {
      zoomTo(pinch.current.scale * (distance(a, b) / pinch.current.distance));
    } else if (scale > 1) {
      setOffset((o) => ({ x: o.x + current.x - previous.x, y: o.y + current.y - previous.y }));
    }
  };
  const up = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (e.pointerType === "touch" && pointers.current.size === 0) {
      const now = Date.now();
      if (now - lastTap.current < 280) zoomTo(scale > 1 ? 1 : DOUBLE_TAP_SCALE);
      lastTap.current = now;
    }
  };

  const image = images[Math.min(index, images.length - 1)];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={frame}
        data-swipe-ignore={scale > 1 ? "" : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => {
          // Touch double-taps are handled in `up`; some browsers also send a dblclick for them.
          if (Date.now() - lastTap.current > 500) zoomTo(scale > 1 ? 1 : DOUBLE_TAP_SCALE);
        }}
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-black select-none",
          scale > 1 ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-zoom-in touch-pan-y",
        )}
      >
        {image?.src ? (
          <img
            src={image.src}
            alt={image.alt}
            draggable={false}
            className="size-full object-contain"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm text-white/70">
            Image unavailable
          </span>
        )}
        <div className="absolute right-2 bottom-2 flex gap-1 rounded-lg bg-black/55 p-1 text-white">
          <ZoomButton label="Zoom out" onClick={() => zoomTo(scale / 1.5)} icon={<Minus />} />
          <ZoomButton label="Zoom in" onClick={() => zoomTo(scale * 1.5)} icon={<Plus />} />
          <ZoomButton label="Reset zoom" onClick={reset} icon={<RotateCcw />} />
        </div>
        {images.length > 1 && (
          <span className="num absolute top-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
            {index + 1} / {images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div data-swipe-ignore className="flex scrollbar-none gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`Screen ${i + 1}`}
              aria-current={i === index}
              onClick={() => {
                setIndex(i);
                reset();
              }}
              className={cn(
                "aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-black",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {img.src && <img src={img.src} alt="" className="size-full object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoomButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      className="text-white hover:bg-white/15 hover:text-white"
    >
      {icon}
    </Button>
  );
}
