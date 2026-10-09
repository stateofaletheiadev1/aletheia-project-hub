import type { Metadata } from "next";
import { ProsePage } from "@/components/editorial/ProsePage";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms of use for aletheiagov.org, the website of the founding government of Aletheia.",
};

export default function TermsPage() {
  return (
    <ProsePage
      mark={{ n: "L2", label: "Policies" }}
      title="Terms of use"
      lede="What this website is, what it is not, and how its contents may be used."
      margin={[
        { label: "Applies to", value: "aletheiagov.org" },
        { label: "Version", value: "Founding edition, October 2026" },
      ]}
    >
      <h2>What this website is</h2>
      <p>
        aletheiagov.org is the public record of the founding government of the Sovereign Covenant State of Aletheia, a government-in-formation. Aletheia does not currently hold recognised territory or international recognition.
      </p>
      <p>
        Nothing on this site is an offer of citizenship, residence, office, employment, investment or legal tender. Institutions described here are proposed or in formation unless marked Operational.
      </p>

      <h2>Official records</h2>
      <p>
        A record is official when it is published here with a reference in the form AGV-TYPE-YEAR-NUMBER. If you find a document elsewhere that claims to come from the founding government, check its reference against this site.
      </p>

      <h2>Using the contents</h2>
      <p>
        Published records may be quoted and shared with their reference. Photographs are used under their own licences, listed on the image credits page. The arms of the State may not be used to suggest endorsement.
      </p>

      <h2>Changes</h2>
      <p>These terms may change. Each change will be published with its date.</p>
    </ProsePage>
  );
}
