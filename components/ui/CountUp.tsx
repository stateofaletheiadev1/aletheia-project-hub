'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** Formats the in-flight number; defaults to en-GB grouping. */
  format?: 'number' | 'aey-compact';
  durationMs?: number;
}

function render(n: number, format: CountUpProps['format']) {
  if (format === 'aey-compact') {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  }
  return Math.round(n).toLocaleString('en-GB');
}

/** Counts up to `value` once scrolled into view. Server-renders the final value. */
export function CountUp({ value, format = 'number', durationMs = 1600 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / durationMs);
        setShown(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setShown(0);
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tabular-nums" aria-label={render(value, format)}>
      <span aria-hidden="true">{render(shown, format)}</span>
    </span>
  );
}
