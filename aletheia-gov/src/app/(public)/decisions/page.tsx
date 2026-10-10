import type { Metadata } from "next";
import { RegisterPage } from "@/components/editorial/RegisterPage";

export const metadata: Metadata = {
  title: "Decisions",
  description: "Published institutional decisions of the founding government, each with its reference, issuing body and change history.",
};

export default function DecisionsPage() {
  return (
    <RegisterPage
      kind="decision"
      basePath="/decisions"
      mark={{ n: "R2", label: "Decisions" }}
      title="Decisions"
      lede="What the founding government has decided, by whom, and on what basis. A decision appears here only after it is adopted and a second authorised officer approves its publication."
      pattern="AGV-DEC-····-····"
      margin={[
        { label: "Reference format", value: <span className="t-ref">AGV-DEC-YYYY-NNNN</span> },
        { label: "Publication rule", value: "Publishing authority plus a second approver" },
        { label: "Amendments", value: "Shown in each decision’s change history" },
      ]}
      emptyTitle="No decisions have been published yet."
      emptyText="Each decision will show its issuing body, date, summary, full text, related documents and any later amendment or revocation."
    />
  );
}
