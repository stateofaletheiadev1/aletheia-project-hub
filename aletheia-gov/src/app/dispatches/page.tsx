import type { Metadata } from "next";
import { RegisterPage } from "@/components/editorial/RegisterPage";

export const metadata: Metadata = {
  title: "Dispatches",
  description: "Announcements and notices from the founding government of Aletheia.",
};

export default function DispatchesPage() {
  return (
    <RegisterPage
      kind="dispatch"
      basePath="/dispatches"
      mark={{ n: "R3", label: "Dispatches" }}
      title="Dispatches"
      lede="Announcements and notices from the founding government: what has happened, what has been decided, and what comes next."
      image="evening-sea"
      pattern="AGV-DSP-····-····"
      margin={[
        { label: "Reference format", value: <span className="t-ref">AGV-DSP-YYYY-NNNN</span> },
        { label: "Publication rule", value: "Reviewed and approved before publication" },
      ]}
      emptyTitle="No dispatches have been published yet."
      emptyText="The first dispatch will be published when there is something verifiable to report."
    />
  );
}
