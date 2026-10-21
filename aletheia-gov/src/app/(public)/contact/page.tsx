import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/editorial/ProsePage";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to contact the founding government of Aletheia, office by office.",
};

const OFFICES = [
  ["General enquiries", "Questions about the founding government and this record.", site.contact.general],
  ["Recruitment", "Questions about a published position or your application.", site.contact.general],
  ["Press", "Requests from journalists.", site.contact.press],
  ["Privacy and data", "Requests about personal data, including erasure.", site.contact.general],
  ["Security", "Reports of vulnerabilities in this platform.", site.contact.security],
] as const;

export default function ContactPage() {
  return (
    <ProsePage
      mark={{ n: "C", label: "Contact" }}
      title="Contact"
      lede="Write to the office responsible. Every message is read by the founding team, and we aim to reply within a few working days."
      margin={[
        { label: "General enquiries", value: <a className="link-ledger" href={`mailto:${site.contact.general}`}>{site.contact.general}</a> },
        { label: "National website", value: <a className="link-ledger" href={site.nationalSite}>stateofaletheia.org</a> },
      ]}
    >
      <h2>Offices</h2>
      <ul>
        {OFFICES.map(([name, text, email]) => (
          <li key={name}>
            <strong className="font-semibold">{name}.</strong> {text}{" "}
            <a className="link-ledger" href={`mailto:${email}`}>
              {email}
            </a>
          </li>
        ))}
      </ul>
      <p>
        The founding government writes only from these addresses and from no-reply@stateofaletheia.org, which sends confirmations and does not receive replies. Positions, founding or otherwise, are recruited only through the <Link href="/opportunities">register of opportunities</Link>.
      </p>
    </ProsePage>
  );
}
