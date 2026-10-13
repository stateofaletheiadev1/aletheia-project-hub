import type { Metadata } from "next";
import { ProsePage } from "@/components/editorial/ProsePage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this website collects, and what it does not. No cookies for visitors, no analytics; registrations of interest and CVs are stored encrypted.",
};

export default function PrivacyPage() {
  return (
    <ProsePage
      mark={{ n: "L1", label: "Policies" }}
      title="Privacy"
      lede="This website sets no cookies for visitors and runs no analytics. It stores personal data only when you register interest, encrypted. This page describes what the code actually does."
      margin={[
        { label: "Cookies", value: "None for visitors; one sign-in cookie for officers" },
        { label: "Analytics", value: "None" },
        { label: "Third-party requests", value: "None from your browser" },
        { label: "Personal data stored", value: "Registrations of interest and CVs, encrypted" },
        { label: "Version", value: "Founding edition, October 2026" },
      ]}
    >
      <h2>What happens when you visit</h2>
      <p>
        Your browser requests pages, images and fonts from this site’s own server. Nothing is loaded from other websites: fonts and photographs are hosted here. Unless you are an officer who signs in, the site sets no cookies and stores nothing in your browser.
      </p>
      <p>
        Like any web server, the server that hosts this site receives your IP address and the page you asked for in order to answer the request. The founding government does not use that information to identify or profile visitors.
      </p>

      <h2>Search</h2>
      <p>Search terms are processed on the server to produce results and are not stored.</p>

      <h2>Registering interest</h2>
      <p>
        If you register interest, we keep: your full name, email address, the kinds of position and the institutions you chose, your main area of expertise, your
        optional note, your CV, and the time you registered. We use them only to contact you when positions of those kinds in those institutions are published. Registering again with the same
        email adds to your earlier registration rather than creating a second one.
      </p>
      <ul>
        <li>
          Your name, email, note and CV are encrypted on our server before they are stored, under a key that belongs to you alone. That key is itself encrypted
          with a master key that is kept outside the database. Your CV is checked to be a PDF of at most 2 MB and is never published.
        </li>
        <li>The institutions and area of expertise are stored without encryption, so registrations can be counted and sorted.</li>
        <li>
          Only founding-government officers with the reviewer role can read a registration or open a CV, after signing in to the officers&apos; workbench. Every
          view, preview and download is recorded in an audit log.
        </li>
        <li>
          The data is held in AletheiaDB, the State&apos;s own database, on a server in Oracle Cloud&apos;s Canada Southeast (Toronto) region. It is not shared with
          anyone else.
        </li>
        <li>Each registration and its CVs are deleted 12 months after your latest registration, by a daily clean-up job, and your key is destroyed.</li>
        <li>
          To erase your data we destroy your key. Every stored copy, including any in backups or history, then becomes unreadable.
        </li>
        <li>No email is sent to you: email delivery is not set up yet.</li>
      </ul>

      <h2>Officers&apos; sign-in</h2>
      <p>
        Officers of the founding government sign in to a separate workbench. Signing in sets one cookie, needed to keep the officer signed in: it is encrypted,
        sent only over a secure connection, and ends after 30 minutes without activity or 12 hours in any case. Visitors who do not sign in receive no cookies.
      </p>

      <h2>When applications open</h2>
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
      <p>A contact address for privacy requests, including erasure, will be published here before registrations open on the public site.</p>
    </ProsePage>
  );
}
