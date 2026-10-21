'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Search, X } from 'lucide-react';

export interface TocPart {
  id: string;
  numeral: string;
  title: string;
  articles: { id: string; number: number; title: string }[];
}

export interface NavLabels {
  contents: string;
  search: string;
  searchPlaceholder: string;
  filter: string;
  allParts: string;
  schedules: string;
  preamble: string;
  results: string;
  noResults: string;
  clear: string;
  backToTop: string;
  part: string;
  article: string;
}

interface Props {
  parts: TocPart[];
  schedules: { id: string; number: number; title: string }[];
  legacy: Record<string, string>;
  labels: NavLabels;
}

/** "41", "art 41", "Article 41(2)" → 41 */
function articleNumber(q: string): number | null {
  const m = q.trim().match(/^(?:art(?:icle)?\.?\s*)?(\d{1,3})(?:\(\d+\))?$/i);
  return m ? Number(m[1]) : null;
}

/** Shows only the blocks that match; returns how many are shown, or null when no filter is active. */
function applyFilter(query: string, part: string): number | null {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('.constitution-doc [data-search]'));
  const q = query.trim().toLowerCase();
  const num = articleNumber(q);
  const terms = q.split(/\s+/).filter(Boolean);
  const active = Boolean(q || part);

  let shown = 0;
  for (const el of blocks) {
    const inPart = !part || el.dataset.part === part;
    let match = true;
    if (num !== null) match = el.id === `article-${num}`;
    else if (terms.length) {
      const text = (el.textContent ?? '').toLowerCase();
      match = terms.every((t) => text.includes(t));
    }
    const visible = inPart && match;
    el.hidden = !visible;
    if (visible) shown++;
  }
  for (const c of Array.from(document.querySelectorAll<HTMLElement>('.constitution-doc [data-chapter]'))) {
    c.hidden = !c.querySelector('[data-search]:not([hidden])');
  }
  for (const s of Array.from(document.querySelectorAll<HTMLElement>('.constitution-doc [data-part-section]'))) {
    s.hidden = !s.querySelector('[data-search]:not([hidden])');
  }
  const pre = document.querySelector<HTMLElement>('.constitution-doc [data-preamble]');
  if (pre) pre.hidden = active;
  return active ? shown : null;
}

/**
 * Navigation for the Constitution page. The text itself is server-rendered; this island
 * filters it in place by toggling `hidden` on [data-search] blocks, so nothing is
 * duplicated in the client bundle and deep links keep working.
 */
export function ConstitutionNav({ parts, schedules, legacy, labels }: Props) {
  const [query, setQuery] = useState('');
  const [part, setPart] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [showTop, setShowTop] = useState(false);

  // Anchors from edition 2026.3 (#art-46) land on the article that now carries them.
  useEffect(() => {
    const go = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      const target = legacy[h];
      if (target) {
        history.replaceState(null, '', `#${target}`);
        document.getElementById(target)?.scrollIntoView();
      }
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [legacy]);

  // Printing always prints the whole instrument; the filter is reapplied afterwards.
  const state = useRef({ query: '', part: '' });
  useEffect(() => {
    const reset = () => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.constitution-doc [hidden]'))) el.hidden = false;
    };
    const restore = () => applyFilter(state.current.query, state.current.part);
    window.addEventListener('beforeprint', reset);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', reset);
      window.removeEventListener('afterprint', restore);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 1200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const update = (q: string, p: string) => {
    state.current = { query: q, part: p };
    setQuery(q);
    setPart(p);
    setCount(applyFilter(q, p));
  };

  const num = articleNumber(query);
  const clear = () => update('', '');

  return (
    <>
      <div className="bg-white border border-navy/15 rounded-sm shadow-subtle lg:sticky lg:top-24 flex flex-col lg:max-h-[calc(100vh-7rem)]" data-print-hide>
        <div className="p-5 space-y-4 border-b border-navy/10">
          <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold-shadow block">{labels.contents}</span>

          <div className="relative">
            <label htmlFor="constitution-search" className="sr-only">{labels.search}</label>
            <Search className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="constitution-search"
              type="search"
              value={query}
              onChange={(e) => update(e.target.value, part)}
              placeholder={labels.searchPlaceholder}
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-parchment-light border border-navy/20 rounded-sm text-navy placeholder:text-navy/45 focus:outline-none focus:border-gold focus-visible:ring-2 focus-visible:ring-gold/40"
              autoComplete="off"
            />
            {(query || part) && (
              <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-navy/50 hover:text-navy focus-visible:outline-2 focus-visible:outline-gold rounded-sm" aria-label={labels.clear}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <label htmlFor="constitution-part" className="text-[11px] font-semibold text-navy/60 uppercase tracking-wider block mb-1.5">{labels.filter}</label>
            <select
              id="constitution-part"
              value={part}
              onChange={(e) => update(query, e.target.value)}
              className="w-full px-2.5 py-2 text-sm bg-parchment-light border border-navy/20 rounded-sm text-navy focus:outline-none focus:border-gold focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <option value="">{labels.allParts}</option>
              {parts.map((p) => (
                <option key={p.id} value={p.numeral}>{labels.part} {p.numeral}: {p.title}</option>
              ))}
              <option value="S">{labels.schedules}</option>
            </select>
          </div>

          <p className="text-xs text-navy/65 min-h-[1rem]" role="status" aria-live="polite">
            {count === null ? '' : count === 0 ? labels.noResults : labels.results.replace('{count}', String(count))}
            {num !== null && count === 1 && (
              <>
                {' '}
                <a href={`#article-${num}`} className="font-semibold text-gold-shadow underline underline-offset-2">{labels.article} {num} →</a>
              </>
            )}
          </p>
        </div>

        <nav aria-label={labels.contents} className="overflow-y-auto p-3 text-[13px] flex-1">
          <a href="#preamble" className="block px-2 py-1.5 rounded-sm text-navy/80 hover:bg-parchment-canvas hover:text-navy font-semibold">{labels.preamble}</a>
          {parts.map((p) => (
            <details key={p.id} className="group">
              <summary className="flex items-start gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-navy hover:bg-parchment-canvas list-none focus-visible:outline-2 focus-visible:outline-gold">
                <span className="font-mono text-[11px] text-gold-shadow w-9 shrink-0 pt-px">{p.numeral}</span>
                <span className="font-semibold leading-snug">{p.title}</span>
              </summary>
              <ul className="pl-11 pb-1.5 space-y-0.5">
                <li>
                  <a href={`#${p.id}`} className="block py-1 text-navy/60 hover:text-gold-shadow italic">{labels.part} {p.numeral}</a>
                </li>
                {p.articles.map((a) => (
                  <li key={a.id}>
                    <a href={`#${a.id}`} className="block py-1 text-navy/75 hover:text-gold-shadow leading-snug">
                      <span className="font-mono text-[11px] text-navy/50 mr-1.5">{a.number}</span>
                      {a.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <details className="group">
            <summary className="flex items-start gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-navy hover:bg-parchment-canvas list-none focus-visible:outline-2 focus-visible:outline-gold">
              <span className="font-mono text-[11px] text-gold-shadow w-9 shrink-0 pt-px">1–{schedules.length}</span>
              <span className="font-semibold">{labels.schedules}</span>
            </summary>
            <ul className="pl-11 pb-1.5 space-y-0.5">
              {schedules.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block py-1 text-navy/75 hover:text-gold-shadow leading-snug">
                    <span className="font-mono text-[11px] text-navy/50 mr-1.5">{s.number}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>
      </div>

      {showTop && (
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0 });
            document.getElementById('constitution-search')?.focus({ preventScroll: true });
          }}
          className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-sm bg-navy text-gold border border-gold/40 shadow-institutional flex items-center justify-center hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-gold"
          aria-label={labels.backToTop}
          data-print-hide
        >
          <ArrowUp className="w-5 h-5" />
        </a>
      )}
    </>
  );
}
