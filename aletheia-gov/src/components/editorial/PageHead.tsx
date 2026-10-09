import { Contours } from "@/components/brand/Contours";
import { Photo } from "@/components/media/Photo";
import { SectionMark } from "./SectionMark";

// The navy masthead that opens every interior page: title and lede on the left,
// an optional graded photograph beside it (never behind the text).
export function PageHead({
  mark,
  title,
  lede,
  image,
  imageCaption,
  contour = "b",
  children,
}: {
  mark: { n: string; label: string };
  title: string;
  lede: string;
  image?: string;
  imageCaption?: string;
  contour?: "a" | "b" | "c";
  children?: React.ReactNode;
}) {
  return (
    <header className="sea relative overflow-hidden">
      <Contours variant={contour} opacity={0.07} parallax={0.05} eager />
      <div className="shell relative grid-12 items-end gap-y-12 pb-16 pt-[calc(var(--header-h)+4.5rem)] md:pb-24 md:pt-[calc(var(--header-h)+7rem)]">
        <div className={image ? "col-span-12 lg:col-span-7" : "col-span-12 lg:col-span-9"}>
          <SectionMark n={mark.n} label={mark.label} tone="sea" className="late-fade" />
          <h1 id="page-title" tabIndex={-1} className="t-h1 mt-8 text-parchment-50 outline-none">
            <span className="mask-line">
              <span>{title}</span>
            </span>
          </h1>
          <p className="t-lede late-fade mt-7 max-w-[46ch] text-parchment-300" style={{ "--d": "260ms" } as React.CSSProperties}>
            {lede}
          </p>
          {children ? (
            <div className="late-fade mt-10" style={{ "--d": "380ms" } as React.CSSProperties}>
              {children}
            </div>
          ) : null}
        </div>
        {image ? (
          <div className="col-span-12 lg:col-span-5">
            <Photo
              name={image}
              priority
              reveal={false}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="aspect-[4/3] lg:aspect-[4/5]"
              caption={imageCaption}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
