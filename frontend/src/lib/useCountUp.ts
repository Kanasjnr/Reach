import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number | undefined, durationMs = 700) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === undefined) return;
    const from = prevTarget.current;
    const start = performance.now();

    let frame: number;
    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target! - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else prevTarget.current = target!;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
