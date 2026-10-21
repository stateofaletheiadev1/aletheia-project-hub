import { Fragment, type ReactNode } from 'react';
import { CONSTITUTION, type Article, type Clause } from '@/lib/constitution';

/**
 * The full text of the draft Constitution, rendered on the server. Cross-references
 * ("Article 42(3)", "Schedule 8", "Part XX") become in-page links. Every article and
 * schedule carries data-search so the navigation island can filter without
 * shipping the text twice.
 */

const REF = /\b(Articles? (\d+)(\(\d+\))?(?:–(\d+))?|Schedules? (\d+)|Part ([IVX]+)\b)/g;

function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const href = m[2] ? `#article-${m[2]}` : m[5] ? `#schedule-${m[5]}` : `#part-${m[6].toLowerCase()}`;
    out.push(
      <a key={i} href={href} className="constitution-ref">
        {m[0]}
      </a>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ClauseList({ clauses, style }: { clauses: Clause[]; style: 'article' | 'schedule' }) {
  return (
    <ol className="constitution-clauses">
      {clauses.map((c) => (
        <li key={c.n} className="constitution-clause">
          <span className="constitution-clause-num" aria-hidden="true">
            {style === 'article' ? `(${c.n})` : `${c.n}.`}
          </span>
          <div className="min-w-0">
            <p>{linkify(c.text)}</p>
            {c.items && (
              <ol className="constitution-items">
                {c.items.map((it, i) => (
                  <li key={i}>
                    <span className="constitution-item-num" aria-hidden="true">({String.fromCharCode(97 + i)})</span>
                    <span>{linkify(it)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ArticleBlock({ a, prev, next }: { a: Article; prev?: Article; next?: Article }) {
  const legacy = Object.entries(CONSTITUTION.legacy).filter(([, id]) => id === a.id).map(([old]) => old);
  return (
    <article id={a.id} data-search data-part={a.part} className="constitution-article scroll-mt-28" aria-labelledby={`${a.id}-h`}>
      {legacy.map((old) => (
        <span key={old} id={old} className="constitution-legacy-anchor" aria-hidden="true" />
      ))}
      <header className="constitution-article-head">
        <h4 id={`${a.id}-h`}>
          <span className="constitution-article-num">Article {a.number}</span>
          <span className="constitution-article-title">{a.title}</span>
        </h4>
        <a href={`#${a.id}`} className="constitution-permalink" aria-label={`Link to Article ${a.number}`} data-print-hide>
          §
        </a>
      </header>
      <ClauseList clauses={a.clauses} style="article" />
      <nav className="constitution-prevnext" aria-label={`Around Article ${a.number}`} data-print-hide>
        {prev ? <a href={`#${prev.id}`}>← Article {prev.number}</a> : <span />}
        {next ? <a href={`#${next.id}`}>Article {next.number} →</a> : <a href="#schedules">Schedules →</a>}
      </nav>
    </article>
  );
}

export function ConstitutionText({ lead }: { lead?: ReactNode }) {
  const { parts, articles, schedules, preamble, preambleNote } = CONSTITUTION;
  const index = new Map(articles.map((a, i) => [a.id, i]));
  const around = (a: Article) => {
    const i = index.get(a.id)!;
    return { prev: articles[i - 1], next: articles[i + 1] };
  };

  return (
    <div className="constitution-doc" lang="en">
      {lead}

      <section id="preamble" className="constitution-preamble scroll-mt-28" data-preamble aria-labelledby="preamble-h">
        <h2 id="preamble-h" className="constitution-part-title">Preamble</h2>
        {preamble.map((p, i) => (
          <p key={i} className={i === preamble.length - 1 ? 'constitution-motto' : undefined}>{p}</p>
        ))}
        <p className="constitution-preamble-note">{linkify(preambleNote)}</p>
      </section>

      {parts.map((p) => (
        <section key={p.id} id={p.id} data-part-section={p.numeral} className="constitution-part scroll-mt-28" aria-labelledby={`${p.id}-h`}>
          <h2 id={`${p.id}-h`} className="constitution-part-title">
            <span className="constitution-part-num">Part {p.numeral}</span>
            <span>{p.title}</span>
          </h2>
          {p.chapters.map((c, ci) => (
            <div key={ci} className="constitution-chapter" data-chapter>
              <h3 className="constitution-chapter-title">{c.title}</h3>
              {c.articles.map((a) => (
                <ArticleBlock key={a.id} a={a} {...around(a)} />
              ))}
            </div>
          ))}
        </section>
      ))}

      <section id="schedules" className="constitution-part scroll-mt-28" data-part-section="S" aria-labelledby="schedules-h">
        <h2 id="schedules-h" className="constitution-part-title">
          <span className="constitution-part-num">Schedules</span>
          <span>Schedules to the Constitution</span>
        </h2>
        {schedules.map((s) => (
          <article key={s.id} id={s.id} data-search data-part="S" className="constitution-article scroll-mt-28" aria-labelledby={`${s.id}-h`}>
            <header className="constitution-article-head">
              <h4 id={`${s.id}-h`}>
                <span className="constitution-article-num">Schedule {s.number}</span>
                <span className="constitution-article-title">{s.title}</span>
              </h4>
              <a href={`#${s.id}`} className="constitution-permalink" aria-label={`Link to Schedule ${s.number}`} data-print-hide>
                §
              </a>
            </header>
            <p className="constitution-basis">
              Gives effect to{' '}
              {s.basis.map((a, i) => (
                <Fragment key={a.id}>
                  {i > 0 && (i === s.basis.length - 1 ? ' and ' : ', ')}
                  <a href={`#${a.id}`} className="constitution-ref">Article {a.number}</a>
                </Fragment>
              ))}
              .
            </p>
            {s.sections.map((sec) => (
              <div key={sec.heading} className="constitution-schedule-section">
                <h5>{sec.heading}</h5>
                <ClauseList clauses={sec.clauses} style="schedule" />
              </div>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}
