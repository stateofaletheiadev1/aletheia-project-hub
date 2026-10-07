'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';

interface CountUpProps {
  value: number;
  /** 'aey-compact' renders 2.45B (or the reader's locale equivalent). */
  format?: 'number' | 'aey-compact';
  durationMs?: number;
}

function render(n: number, format: CountUpProps['format'], intl: string) {
  if (format === 'aey-compact' && n >= 1e6) {
    return new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: n >= 1e9 ? 2 : 1 }).format(n);
  }
  return Math.round(n).toLocaleString(intl);
}

/** Counts up to `value` once scrolled into view. Server-renders the final value. */
export function CountUp({ value, format = 'number', durationMs = 1600 }: CountUpProps) {
  const { intl } = useI18n();
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
      const tick = (time: number) => {
        const p = Math.min(1, (time - start) / durationMs);
        setShown(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tabular-nums" aria-label={render(value, format, intl)}>
      <span aria-hidden="true">{render(shown, format, intl)}</span>
    </span>
  );
}
