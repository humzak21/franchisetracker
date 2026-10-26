import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

/** Animates a number from its previous value (or 0) to `target`. Instant under reduced motion. */
export function useCountUp(target: number, durationMs = 650): number {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - t) ** 4;
      setValue(Math.round(origin + (target - origin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);

  return reduced ? target : value;
}
