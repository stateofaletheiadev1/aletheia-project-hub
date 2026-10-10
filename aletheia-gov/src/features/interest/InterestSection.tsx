import { SectionMark } from "@/components/editorial/SectionMark";
import { interestConfigured } from "@/server/services/interest";
import { InterestForm } from "./InterestForm";
import { INSTITUTION_GROUPS, INTEREST_INSTITUTIONS } from "./schema";

const GROUPS = INSTITUTION_GROUPS.map((g) => ({
  title: g.title,
  options: INTEREST_INSTITUTIONS.filter((i) => g.kinds.includes(i.kind)).map((i) => ({ slug: i.slug, name: i.name })),
})).filter((g) => g.options.length);

// "Register your interest": the way to show interest in an institution before founding
// roles are published. Shown only when storage and encryption are configured.
export function InterestSection({ institution, mark = "R" }: { institution?: { slug: string; name: string }; mark?: string }) {
  const open = interestConfigured();
  return (
    <section aria-labelledby="interest-heading" className="ledger-pale chapter">
      <div className="shell grid-12 gap-y-10">
        <div className="col-span-12 lg:col-span-4">
          <SectionMark n={mark} label="Register your interest" />
          <h2 id="interest-heading" className="t-h1 mt-8">
            {institution ? `Help found ${/^The /.test(institution.name) ? institution.name.replace(/^The /, "the ") : `the ${institution.name}`}.` : "Help found an institution."}
          </h2>
          <p className="mt-6 max-w-[40ch] text-[1.0625rem] leading-relaxed text-ink-600">
            No roles are open yet. Choose every institution you would like to help found, leave your details and attach your CV. You will be among the first contacted when founding roles are published.
          </p>
          <p className="mt-6 max-w-[40ch] text-[0.875rem] leading-relaxed text-ink-500">
            Your name, email, note and CV are encrypted before they are stored. Registering is not an application and confers no role or status.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-7 lg:col-start-6">
          {open ? (
            <InterestForm groups={GROUPS} preselected={institution?.slug} />
          ) : (
            <div className="border-t-2 border-navy-800 pt-6">
              <p className="t-h3">Registration of interest is not open yet.</p>
              <p className="mt-3 max-w-[52ch] text-[0.9375rem] text-ink-600">It opens when the public record database is connected to this site.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
