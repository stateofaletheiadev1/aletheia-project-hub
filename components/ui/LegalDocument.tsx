import type { ReactNode } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import type { PhotoKey } from '@/lib/imagery';

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalDocumentProps {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  image: PhotoKey;
  updated: string;
  sections: LegalSection[];
}

/** Long-form legal page: hero, sticky table of contents, numbered sections. */
export function LegalDocument({ eyebrow, title, lead, image, updated, sections }: LegalDocumentProps) {
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero eyebrow={eyebrow} image={image} title={title} lead={lead} />

      <section className="section-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <nav className="lg:col-span-4 lg:sticky lg:top-28 h-fit" aria-label="Contents" data-print-hide>
            <div className="sovereign-card-premium rounded-sm p-6 space-y-4">
              <div className="eyebrow">Contents</div>
              <ol className="space-y-1">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex gap-3 py-1.5 text-sm text-navy/65 hover:text-navy transition-colors">
                      <span className="font-mono text-xs text-gold-shadow pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                      <span className="link-draw">{s.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <p className="pt-4 border-t border-navy/10 text-[11px] font-mono text-navy/45">Last updated {updated}</p>
            </div>
          </nav>

          <div className="lg:col-span-8 bg-white border border-navy/10 rounded-sm shadow-institutional p-8 sm:p-12 space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="space-y-4">
                <h2 className="text-xl font-bold text-navy flex items-baseline gap-3">
                  <span className="font-mono text-sm text-gold-shadow">{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </h2>
                <div className="text-[15px] text-navy/75 leading-[1.85] space-y-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-gold-shadow [&_a]:underline [&_a]:underline-offset-4">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
