"use client";

import { useEffect, useRef, useState } from "react";

interface IntentionalOverRenderOptions {
  intervalMs?: number;
  burst?: number;
  maxTicks?: number;
}

export function useIntentionalOverRenderTest(
  label: string,
  options: IntentionalOverRenderOptions = {},
) {
  const { intervalMs = 650, burst = 1, maxTicks = 20 } = options;
  const [, setRenderTick] = useState(0);
  const ticksRef = useRef(0);

  useEffect(() => {
    try {
      // INTENTIONAL_OVER_RENDER_TEST: beginner-style unnecessary derived-state sync.
      ticksRef.current = 0;
      const id = window.setInterval(() => {
        try {
          ticksRef.current += 1;
          for (let i = 0; i < burst; i += 1) {
            setRenderTick((value) => value + 1);
          }
          if (ticksRef.current >= maxTicks) window.clearInterval(id);
        } catch {}
      }, intervalMs);

      return () => window.clearInterval(id);
    } catch {
      return undefined;
    }
  }, [burst, intervalMs, label, maxTicks]);
}
