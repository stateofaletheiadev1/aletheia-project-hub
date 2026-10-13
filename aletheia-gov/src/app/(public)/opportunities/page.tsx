import type { Metadata } from "next";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import Link from "next/link";
import { RegisterPage } from "@/components/editorial/RegisterPage";
import { POSITION_TYPES } from "@/content/positions";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Positions in the institutions of Aletheia (founding roles, and permanent, fixed-term, advisory and volunteer positions), published with a reference, a mandate and selection criteria.",
};

const steps = [
  ["Published", "Each role is published with its reference, institution, responsibilities, qualifications and closing date. Compensation is stated only if approved; otherwise the role says so."],
  ["Applied for", "Applications are made through the applicant portal and saved as you go. You can withdraw at any point before a decision."],
  ["Reviewed by two", "Two reviewers score each application against a published rubric. A reviewer with a conflict of interest steps aside."],
  ["Decided with reasons", "Every application receives a decision. An accepted application is referred to an appointing authority; it is not itself an appointment."],
  ["Appointed in public", "Appointments are issued as separate instruments and published in the register of appointments."],
] as const;

export default function OpportunitiesPage() {
  return (
    <RegisterPage
      kind="opportunity"
      basePath="/opportunities"
      mark={{ n: "P1", label: "Opportunities" }}
      title="Opportunities"
      lede="Aletheia is being built by people who choose to. Founding roles and every other position are recruited in the open, against published criteria, with every appointment on the record."
      image="working-papers"
      pattern="AGV-OPP-····-····"
      margin={[
        { label: "Reference format", value: <span className="t-ref">AGV-OPP-YYYY-NNNN</span> },
        { label: "Kinds of position", value: POSITION_TYPES.map((p) => p.name).join(" · ") },
        { label: "Review", value: "Two reviewers, published rubric" },
        { label: "Personal data", value: "Encrypted before storage; never published" },
      ]}
      emptyTitle="No positions are open at this time."
      emptyText="Roles will be published here with a reference and a closing date. Nothing is recruited outside this register."
    >
      <section aria-labelledby="how">
        <h2 id="how" className="t-h2">
          How recruitment works
        </h2>
        <p className="t-body mt-4 text-ink-600">
          The same process applies to every kind of position. The applicant portal opens with the first published position. Until then, no applications are taken through this site or anywhere else; you can{" "}
          <Link className="link-ledger" href="/register-interest">
            register your interest
          </Link>{" "}
          to be contacted when one opens.
        </p>
        <ol className="mt-10 border-t rule">
          {steps.map(([title, text], i) => (
            <li
              key={title}
              data-reveal-on
              style={{ "--stagger": i } as React.CSSProperties}
              className="grid gap-3 border-b rule py-7 md:grid-cols-[3rem_12rem_1fr] md:gap-6"
            >
              <span className="t-ref text-gold-700">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[1.125rem] font-semibold">{title}</span>
              <span className="text-[0.9844rem] leading-relaxed text-ink-600">{text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <ArrowLink href="/build-aletheia">Other ways to contribute</ArrowLink>
        </div>
      </section>
    </RegisterPage>
  );
}
