import { Contours } from "@/components/brand/Contours";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { SectionMark } from "@/components/editorial/SectionMark";
import { PublicFrame } from "@/components/navigation/PublicFrame";

export default function NotFound() {
  // Unmatched URLs render outside the (public) group, so this page brings its own frame.
  return (
    <PublicFrame>
    <section className="sea relative flex min-h-[88vh] items-center overflow-hidden">
      <Contours variant="c" opacity={0.08} eager />
      <div className="shell relative pb-24 pt-[calc(var(--header-h)+5rem)]">
        <SectionMark n="404" label="Not in the record" tone="sea" />
        <h1 id="page-title" tabIndex={-1} className="t-display mt-10 max-w-[14ch] text-parchment-50 outline-none">
          There is no record at this address.
        </h1>
        <p className="mt-8 max-w-[48ch] text-[1.0625rem] leading-relaxed text-parchment-300">
          The page may have moved, or it may never have been published. Records that are withdrawn leave the public pages.
        </p>
        <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t rule pt-8">
          <ArrowLink href="/" tone="sea">
            The front page
          </ArrowLink>
          <ArrowLink href="/search" tone="sea">
            Search the record
          </ArrowLink>
        </div>
      </div>
    </section>
    </PublicFrame>
  );
}
