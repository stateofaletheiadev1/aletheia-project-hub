import type { Metadata } from "next";
import { RegisterPage } from "@/components/editorial/RegisterPage";

export const metadata: Metadata = {
  title: "Documents",
  description: "The document library of the founding government: founding texts, frameworks and reports, each versioned and referenced.",
};

export default function DocumentsPage() {
  return (
    <RegisterPage
      kind="document"
      basePath="/documents"
      mark={{ n: "R1", label: "Documents" }}
      title="The document library"
      lede="Founding texts, frameworks, specifications and reports. Every version is kept, and every published version carries a content hash."
      image="library"
      pattern="AGV-DOC-····-····"
      margin={[
        { label: "Reference format", value: <span className="t-ref">AGV-DOC-YYYY-NNNN</span> },
        { label: "Publication rule", value: "An author cannot approve their own document." },
        { label: "Superseded versions", value: "Kept and clearly labelled" },
      ]}
      emptyTitle="No documents have been published yet."
      emptyText="The National Blueprint and the founding framework will be published here as versioned documents once they have passed review. Each will show its version history, issuing body and SHA-256 hash."
    />
  );
}
