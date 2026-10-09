import { Folio, MarginMeta, type MarginItem } from "./Folio";
import { PageHead } from "./PageHead";

// A reading page: masthead, margin column, prose.
export function ProsePage({
  mark,
  title,
  lede,
  margin,
  children,
}: {
  mark: { n: string; label: string };
  title: string;
  lede: string;
  margin: MarginItem[];
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHead mark={mark} title={title} lede={lede} contour="c" />
      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio margin={<MarginMeta items={margin} />}>
          <article className="prose-ledger">{children}</article>
        </Folio>
      </div>
    </>
  );
}
