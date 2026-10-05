'use client';

import { useState } from 'react';

interface MonthlyColumnsProps {
  title: string;
  unit: string;
  data: { label: string; value: number }[];
}

/**
 * Single-series column chart: navy columns (≤24px, 4px rounded data-ends,
 * square at the baseline), recessive gridlines, the latest value labelled
 * directly, a per-column hover tooltip, and a table view for screen readers.
 */
export function MonthlyColumns({ title, unit, data }: MonthlyColumnsProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 500) * 500 || 1;
  const ticks = [0, niceMax / 2, niceMax];
  const last = data.length - 1;

  return (
    <figure className="space-y-4">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-bold text-navy">{title}</span>
        <span className="text-[11px] font-mono text-navy/50">per month · {unit}</span>
      </figcaption>

      <div className="relative h-56 pl-10" aria-hidden="true">
        {ticks.map((t) => (
          <div key={t} className="absolute left-10 right-0 flex items-center" style={{ bottom: `${(t / niceMax) * 100}%` }}>
            <span className="absolute -left-10 w-8 text-right text-[10px] font-mono text-navy/40 -translate-y-1/2">
              {t >= 1000 ? `${t / 1000}k` : t}
            </span>
            <div className={`w-full h-px ${t === 0 ? 'bg-navy/25' : 'bg-navy/[0.07]'}`} />
          </div>
        ))}

        <div className="absolute left-10 right-0 bottom-0 top-0 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const h = (d.value / niceMax) * 100;
            const on = active === i;
            return (
              <div
                key={d.label}
                className="relative flex-1 h-full flex items-end justify-center cursor-default"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <div
                  className={`w-full max-w-[24px] rounded-t-[4px] transition-colors duration-200 ${on ? 'bg-gold' : i === last ? 'bg-navy' : 'bg-navy-subtle/80'}`}
                  style={{ height: `${h}%` }}
                />
                {i === last && active === null && (
                  <span className="absolute text-[11px] font-bold text-navy -translate-y-full pb-1" style={{ bottom: `${h}%` }}>
                    {d.value.toLocaleString('en-GB')}
                  </span>
                )}
                {on && (
                  <div className="absolute z-10 -translate-y-full pb-2 pointer-events-none" style={{ bottom: `${h}%` }}>
                    <div className="bg-navy-deep text-parchment rounded-sm px-3 py-2 shadow-elevated whitespace-nowrap border border-gold/30">
                      <div className="text-[10px] uppercase tracking-wider text-parchment/55">{d.label}</div>
                      <div className="text-sm font-bold">{d.value.toLocaleString('en-GB')} <span className="text-[10px] font-normal text-parchment/60">{unit}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pl-10 flex gap-[2px]" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center text-[9px] font-mono text-navy/45">
            {i % 2 === last % 2 ? d.label : ''}
          </span>
        ))}
      </div>

      <details className="text-xs text-navy/60">
        <summary className="cursor-pointer font-semibold hover:text-navy">View as table</summary>
        <table className="sovereign-table mt-3 text-xs">
          <thead><tr><th className="text-left">Month</th><th className="text-right">{unit}</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}><td>{d.label}</td><td className="text-right tabular-nums">{d.value.toLocaleString('en-GB')}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
