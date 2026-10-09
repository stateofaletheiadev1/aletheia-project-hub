import type { Metadata } from "next";
import Image from "next/image";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { allCredits } from "@/content/images";

export const metadata: Metadata = {
  title: "Image credits",
  description: "Sources and licences of the photographs used on aletheiagov.org.",
};

export default function ImageCreditsPage() {
  return (
    <>
      <PageHead
        mark={{ n: "L4", label: "Policies" }}
        title="Image credits"
        lede="Every photograph on this site, where it comes from, and the licence it is used under. None shows Aletheian territory, buildings or vessels."
        contour="c"
      />
      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Photographs", value: <span className="t-ref text-[0.9375rem]">{allCredits.length}</span> },
                { label: "Hosting", value: "Self-hosted; never hotlinked" },
                { label: "Treatment", value: "One consistent grade: cooled shadows, lifted blacks, reduced saturation" },
              ]}
            />
          }
        >
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
            {allCredits.map((c) => (
              <li key={c.file} className="border-t rule pt-5">
                <Image
                  src={c.file}
                  alt={c.alt}
                  width={c.width}
                  height={c.height}
                  sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 100vw"
                  quality={60}
                  placeholder="blur"
                  blurDataURL={c.blur}
                  className="aspect-[3/2] w-full object-cover"
                />
                <p className="mt-4 text-[0.9375rem] font-medium">{c.subject}</p>
                <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-1 text-[0.8125rem] text-ink-600">
                  <dt>Used for</dt>
                  <dd>{c.use}</dd>
                  <dt>Source</dt>
                  <dd>
                    <a className="link-ledger" href={c.sourceUrl} rel="noopener">
                      {c.source}
                    </a>
                    {c.author ? `, ${c.author}` : ", photographer to be confirmed"}
                  </dd>
                  <dt>Licence</dt>
                  <dd>
                    <a className="link-ledger" href={c.licenceUrl} rel="noopener">
                      {c.licence}
                    </a>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </Folio>
      </div>
    </>
  );
}
