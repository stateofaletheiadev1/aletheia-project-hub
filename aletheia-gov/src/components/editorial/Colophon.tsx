import Link from "next/link";
import { Arms } from "@/components/brand/Arms";
import { Contours } from "@/components/brand/Contours";
import { FoundingNotice } from "@/components/editorial/FoundingNotice";
import { formatDateLong } from "@/lib/dates";
import { footerNav, site } from "@/lib/site";
import { lastPublishedAt } from "@/server/records/public-records";

// Set like the colophon of a printed book (brief §6.5.5).
export async function Colophon() {
  const last = await lastPublishedAt();
  const edition = formatDateLong(new Date());
  return (
    <footer className="sea relative overflow-hidden border-t border-[var(--rule-sea)]">
      <Contours variant="c" tone="gold" opacity={0.09} />
      <div className="shell relative pb-10 pt-24 md:pt-32">
        <div className="grid-12 gap-y-14">
          <div className="col-span-12 flex items-start gap-8 lg:col-span-6">
            <Arms height={112} className="h-[112px] w-auto shrink-0" />
            <div>
              <p className="t-meta text-gold-400">{site.officialName}</p>
              <p className="mt-5 text-[clamp(2rem,3.4vw,3rem)] font-extralight leading-none tracking-[-0.02em] text-parchment-50">
                {site.motto.latin}
              </p>
              <p className="mt-3 text-[1.0625rem] text-parchment-300">{site.motto.english}</p>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <FoundingNotice variant="colophon" />
          </div>
        </div>

        <nav aria-label="Footer" className="mt-20 grid grid-cols-2 gap-x-8 gap-y-12 border-t rule pt-12 md:grid-cols-4">
          {footerNav.map((col) => (
            <div key={col.title}>
              <p className="t-meta text-[0.6875rem] text-gold-400">{col.title}</p>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="draw-link text-[0.9375rem] text-parchment-200 hover:text-parchment-50">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-20 flex flex-col gap-4 border-t rule pt-8 text-[0.8125rem] text-parchment-300 lg:flex-row lg:items-center lg:justify-between">
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <span>Edition of {edition}</span>
            <span>{last ? `Last publication ${formatDateLong(last)}` : "No records published yet"}</span>
            <span>Capital (proposed): {site.capital}</span>
          </p>
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={site.nationalSite} className="draw-link text-parchment-200 hover:text-parchment-50" rel="noopener">
              The State: stateofaletheia.org ↗
            </a>
            <span>The Founding Government of Aletheia</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
