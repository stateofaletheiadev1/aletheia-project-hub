import { Download, ScrollText } from 'lucide-react';
import { CONSTITUTION, CHANGELOG, EDITION, articleByKey, constitutionJsonLd } from '@/lib/constitution';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';
import { StarOfTruth } from '@/components/brand/Logo';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { ConstitutionText } from '@/components/constitution/ConstitutionText';
import { ConstitutionNav, type TocPart } from '@/components/constitution/ConstitutionNav';
import { PrintButton } from '@/components/constitution/PrintButton';

function longDate(iso: string, intl: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default async function ConstitutionPage({ params }: PageProps<'/[lang]/constitution'>) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const { t } = await getTranslator(locale);
  const intl = locale === 'en' ? 'en-GB' : locale;

  const { parts, articles, schedules, legacy } = CONSTITUTION;
  const effect = articleByKey('effect');
  const toc: TocPart[] = parts.map((p) => ({
    id: p.id,
    numeral: p.numeral,
    title: p.title,
    articles: p.chapters.flatMap((c) => c.articles.map((a) => ({ id: a.id, number: a.number, title: a.title }))),
  }));


  return (
    <div id="top" className="min-h-screen bg-parchment-canvas text-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(constitutionJsonLd()) }} />

      {/* Hero */}
      <section className="guilloche-hero relative text-parchment py-20 lg:py-28 border-b border-gold/30 overflow-hidden print:py-6 print:text-navy print:bg-white print:border-navy/20">
        <HeroBackdrop image="lawLibrary" />
        <div className="orb-gold w-[500px] h-[500px] -top-28 -left-36 opacity-50 animate-orb-float-1" aria-hidden="true" />
        <div className="orb-burgundy w-[360px] h-[360px] bottom-0 right-8 opacity-45 animate-orb-float-2" aria-hidden="true" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-7">
          <div className="inline-flex flex-wrap items-center gap-2.5 px-3.5 py-1.5 bg-navy-deep/80 border border-gold/40 rounded-sm backdrop-blur-sm">
            <StarOfTruth size={16} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Draft Constitution")}</span>
            <span className="text-parchment/30" aria-hidden="true">|</span>
            <span className="text-[11px] text-parchment/75 font-serif italic">{t("Edition {edition}", { edition: EDITION.edition })}</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1 className="heading-hero">{t("The Covenant")}<br />
              <span className="text-gold-metallic">{t("of Aletheia")}</span>
            </h1>
            <p className="text-base sm:text-lg text-parchment/75 leading-[1.85] font-light">{t("The proposed Constitution of the Sovereign Covenant State of Aletheia: a Preamble, {parts} Parts, {articles} Articles and {schedules} Schedules, published for consultation.", { parts: parts.length, articles: articles.length, schedules: schedules.length })}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4" data-print-hide>
            <a href="/pdf/constitution" target="_blank" rel="noopener" className="btn-sovereign-gold px-5 py-2.5 rounded-sm flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t("Download PDF")}</span>
            </a>
            <PrintButton label={t("Print the Draft")} />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 space-y-10">
        {/* Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div role="note" className="lg:col-span-8 bg-navy text-parchment rounded-sm border border-gold/30 p-6 sm:p-7 space-y-3">
            <div className="flex items-center gap-2.5">
              <ScrollText className="w-5 h-5 text-gold" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gold">{t("A proposed Constitution without legal force")}</h2>
            </div>
            <p className="text-sm leading-relaxed text-parchment/85">{t("This is a draft for consultation. It describes the State that Aletheia intends to become; it is not the law of any place, and the institutions it names do not yet exist or exercise authority. It will enter into force only when the conditions of Article {article} are met: ratification by referendum, at least one permanently inhabited platform lawfully established as national territory, and an established register of citizens.", { article: effect.number })}</p>
            {locale !== 'en' && (
              <p className="text-sm leading-relaxed text-gold-tint/90 border-t border-gold/20 pt-3">{t("The text of the draft is published in English, its authoritative language. Official translations will be published once the text is settled.")}</p>
            )}
          </div>
          <dl className="lg:col-span-4 bg-white border border-navy/15 rounded-sm p-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm shadow-subtle">
            <dt className="text-navy/55 text-xs uppercase tracking-wider">{t("Edition")}</dt>
            <dd className="font-semibold">{EDITION.edition}</dd>
            <dt className="text-navy/55 text-xs uppercase tracking-wider">{t("Status")}</dt>
            <dd className="font-semibold">{t("Draft for consultation")}</dd>
            <dt className="text-navy/55 text-xs uppercase tracking-wider">{t("Revised")}</dt>
            <dd className="font-semibold">{longDate(EDITION.date, intl)}</dd>
            <dt className="text-navy/55 text-xs uppercase tracking-wider">{t("Reference")}</dt>
            <dd className="font-mono text-xs pt-0.5">{EDITION.code}</dd>
            <dt className="text-navy/55 text-xs uppercase tracking-wider">{t("Contents")}</dt>
            <dd className="font-semibold">{t("{articles} Articles · {schedules} Schedules", { articles: articles.length, schedules: schedules.length })}</dd>
          </dl>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4">
            <ConstitutionNav
              parts={toc}
              schedules={schedules.map((s) => ({ id: s.id, number: s.number, title: s.title }))}
              legacy={legacy}
              labels={{
                contents: t("Table of Contents"),
                search: t("Search the Constitution"),
                searchPlaceholder: t("Keyword or article number"),
                filter: t("Filter by Part"),
                allParts: t("All Parts"),
                schedules: t("Schedules"),
                preamble: t("Preamble"),
                results: t("{count} provisions match"),
                noResults: t("No provisions match. Try other words."),
                clear: t("Clear search"),
                backToTop: t("Back to top"),
                part: t("Part"),
                article: t("Article"),
              }}
            />
          </aside>

          <div role="region" className="lg:col-span-8 min-w-0" aria-label={t("Text of the draft Constitution")}>
            <ConstitutionText />

            <section id="history" className="mt-12 bg-white border border-navy/15 rounded-sm p-6 sm:p-8 shadow-subtle scroll-mt-28" aria-labelledby="history-h">
              <h2 id="history-h" className="text-lg font-bold text-navy mb-4">{t("Edition history")}</h2>
              <ol className="space-y-4">
                {CHANGELOG.map((c) => (
                  <li key={c.edition} className="grid grid-cols-[6.5rem_1fr] gap-4 text-sm">
                    <div>
                      <div className="font-mono font-semibold text-gold-shadow">{c.edition}</div>
                      <div className="text-xs text-navy/55">{longDate(c.date, intl)}</div>
                    </div>
                    <p className="text-navy/80 leading-relaxed" lang="en">{c.summary}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
