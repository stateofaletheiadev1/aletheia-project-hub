import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/editorial/ProsePage";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to contact the founding government of Aletheia, office by office.",
};

const OFFICES = [
  ["General enquiries", "Questions about the founding government and this record."],
  ["Recruitment", "Questions about a published position."],
  ["Press", "Requests from journalists."],
  ["Privacy and data", "Requests about personal data."],
  ["Security", "Reports of vulnerabilities in this platform."],
] as const;

export default function ContactPage() {
  return (
    <ProsePage
      mark={{ n: "C", label: "Contact" }}
      title="Contact"
      lede="Enquiries will be routed to the office responsible. The enquiry channels are not open yet; this page says so rather than offer an address no one reads."
      margin={[
        { label: "Enquiry channels", value: "Not yet published" },
        { label: "National website", value: <a className="link-ledger" href={site.nationalSite}>stateofaletheia.org</a> },
      ]}
    >
      <h2>Offices</h2>
      <ul>
        {OFFICES.map(([name, text]) => (
          <li key={name}>
            <strong className="font-semibold">{name}.</strong> {text} <span className="text-ink-500">Channel not yet published.</span>
          </li>
        ))}
      </ul>
      <p>
        Each channel will be published on this page when it is staffed. Until then, the founding government makes no contact through any other channel claiming to represent it. Positions, founding or otherwise, are recruited only through the <Link href="/opportunities">register of opportunities</Link>.
      </p>
    </ProsePage>
  );
}
