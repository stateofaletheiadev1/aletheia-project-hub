import type { Metadata } from "next";
import { ProsePage } from "@/components/editorial/ProsePage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this website collects, and what it does not. No cookies, no analytics, no accounts yet.",
};

export default function PrivacyPage() {
  return (
    <ProsePage
      mark={{ n: "L1", label: "Policies" }}
      title="Privacy"
      lede="This website sets no cookies, runs no analytics and holds no accounts. This page describes what the code actually does, and will change when that does."
      margin={[
        { label: "Cookies", value: "None" },
        { label: "Analytics", value: "None" },
        { label: "Third-party requests", value: "None from your browser" },
        { label: "Version", value: "Founding edition, October 2026" },
      ]}
    >
      <h2>What happens when you visit</h2>
      <p>
        Your browser requests pages, images and fonts from this site’s own server. Nothing is loaded from other websites: fonts and photographs are hosted here. The site sets no cookies and stores nothing in your browser.
      </p>
      <p>
        Like any web server, the server that hosts this site receives your IP address and the page you asked for in order to answer the request. The founding government does not use that information to identify or profile visitors.
      </p>

      <h2>Search</h2>
      <p>Search terms are processed on the server to produce results and are not stored.</p>

      <h2>When accounts and applications open</h2>
      <p>
        The applicant portal is not yet open. When it opens, this notice will be updated before any personal data is collected. The platform is designed so that:
      </p>
      <ul>
        <li>applications ask only for what is needed: no passport or identity numbers, banking details, date of birth or protected characteristics;</li>
        <li>personal data is encrypted before it is stored, with keys held outside the database;</li>
        <li>erasure works by destroying a person’s encryption key, so earlier copies become unreadable;</li>
        <li>unsuccessful applications are erased twelve months after the decision.</li>
      </ul>
      <p>
        Data-protection principles from the GDPR and Nigeria’s NDPA were used as design references. That is a statement about design, not a claim of legal compliance or certification.
      </p>

      <h2>Contact</h2>
      <p>A contact for privacy requests will be published on this page before any personal data is collected.</p>
    </ProsePage>
  );
}
