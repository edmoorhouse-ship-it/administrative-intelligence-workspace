"use client";

import { useEffect, useRef, useState } from "react";

const TICK_MS = 28;
const WORD = /\s*\S+/g;

/** Index just past the next `words` words of `text`, starting at `from`. */
function advance(text: string, from: number, words: number): number {
  WORD.lastIndex = from;
  let end = from;
  for (let i = 0; i < words; i++) {
    const match = WORD.exec(text);
    if (!match) return text.length;
    end = match.index + match[0].length;
  }
  return end;
}

/**
 * Reveals `target` word by word as it grows, speeding up when the stream
 * gets ahead so the display never lags far behind the network.
 */
export function useSmoothText(target: string, animate: boolean) {
  const [count, setCount] = useState(() => (animate ? 0 : target.length));
  const countRef = useRef(count);

  useEffect(() => {
    if (countRef.current >= target.length) return;
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const elapsed = now - last;
      if (elapsed >= TICK_MS) {
        last = now;
        const backlog = target.length - countRef.current;
        // Frames can be throttled (background tab), so advance by elapsed ticks to catch up.
        const ticks = Math.max(1, Math.floor(elapsed / TICK_MS));
        const words = ticks * Math.max(1, Math.ceil(backlog / 80));
        const next = advance(target, countRef.current, words);
        countRef.current = next;
        setCount(next);
        if (next >= target.length) return;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const shown = Math.min(count, target.length);
  return { text: target.slice(0, shown), caughtUp: shown >= target.length };
}
