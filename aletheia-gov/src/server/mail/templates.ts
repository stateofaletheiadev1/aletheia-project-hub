import "server-only";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application-status";
import { renderLetter } from "./letter";
import type { Mail } from "./mailer";

// The letters the founding government sends (layout in letter.ts). The reference comes first and
// no letter links to anything that asks for a password or payment, so a genuine message is easy
// to tell from an impersonation.

const SITE = {
  name: "The Government of Aletheia",
  url: "https://aletheiagov.org",
  host: "aletheiagov.org",
  arms: "https://www.aletheiagov.org/brand/email-arms.png",
};

const SIGNATURE = { name: "The Founding Government", role: "Sovereign Covenant State of Aletheia" };

export type RegistrationSummary = {
  fullName: string;
  email: string;
  reference: string;
  /** Title and reference of the published position applied for, if any. */
  position?: { title: string; reference: string };
  institutions: string[];
  positionTypes: string[];
};

function rows(r: RegistrationSummary): [string, string][] {
  return [
    ...(r.position ? ([["Position", `${r.position.title} (${r.position.reference})`]] as [string, string][]) : []),
    ...(r.institutions.length ? ([["Institutions", r.institutions.join(", ")]] as [string, string][]) : []),
    ...(r.positionTypes.length ? ([["Kinds of position", r.positionTypes.join(", ")]] as [string, string][]) : []),
  ];
}

/** To the person: their registration or application was received. */
export function registrationReceived(r: RegistrationSummary): Mail {
  return renderLetter({
    to: r.email,
    subject: r.position ? `Application received: ${r.position.title} (${r.reference})` : `Registration of interest received (${r.reference})`,
    preheader: r.position ? `We have received your application for ${r.position.title}.` : "We have received your registration of interest.",
    kicker: r.position ? "Application received" : "Registration of interest",
    heading: r.position ? "Thank you for applying to serve Aletheia" : "Thank you for offering to serve Aletheia",
    greeting: `Dear ${r.fullName},`,
    paragraphs: [
      r.position
        ? "We have received your application. Every application is read by the founding team, and we will write to you as it progresses."
        : "We have received your registration of interest in serving the institutions of the Sovereign Covenant State of Aletheia. We will contact you when a position that matches it is published.",
    ],
    reference: { label: "Your reference", value: r.reference },
    details: rows(r).length ? { title: "You registered for", rows: rows(r) } : undefined,
    steps: {
      title: "What happens next",
      items: r.position
        ? [
            "The founding team reviews your application against the published position.",
            "We email you whenever its status changes, quoting your reference.",
            "Appointments are published in the register of appointments on aletheiagov.org.",
          ]
        : [
            "Your registration stays on file for twelve months after your latest registration.",
            "When a matching position is published, we will contact you. You may also apply for any published position at aletheiagov.org/opportunities.",
            "To add to your registration, register again with the same email address.",
          ],
    },
    closing: ["You may ask us to erase your details at any time by writing to info@stateofaletheia.org."],
    signature: SIGNATURE,
    site: SITE,
  });
}

/** To the founding team: a new registration to look at. */
export function registrationNotice(r: RegistrationSummary, notify: string): Mail {
  return renderLetter({
    to: notify,
    subject: `New ${r.position ? "application" : "registration"} ${r.reference}${r.position ? `: ${r.position.title}` : ""}`,
    preheader: `${r.fullName} ${r.position ? `applied for ${r.position.title}` : "registered interest"} on aletheiagov.org.`,
    kicker: r.position ? "New application · Notice" : "New registration · Notice",
    heading: r.position ? "A new application has arrived" : "A new registration of interest",
    greeting: "To the Founding Team,",
    paragraphs: ["A new registration was recorded on aletheiagov.org. Review it in the operations workbench."],
    reference: { label: "Reference", value: r.reference },
    details: { title: "Applicant", rows: [["Name", r.fullName], ["Email", r.email], ...rows(r)] },
    signature: { name: "aletheiagov.org", role: "Automatic notice" },
    valediction: null,
    site: SITE,
  });
}

const STATUS: Partial<Record<ApplicationStatus, { heading: string; message: string }>> = {
  contacted: {
    heading: "We would like to speak with you",
    message: "A member of the founding team will be in touch with you about your application shortly, from one of the addresses published on aletheiagov.org/contact.",
  },
  shortlisted: {
    heading: "You have been shortlisted",
    message: "We are pleased to tell you that you have been shortlisted. The founding team will write to you about the next step.",
  },
  offered: {
    heading: "We would like to offer you the position",
    message: "We are pleased to tell you that the founding team would like to offer you the position. We will write to you with the details of the offer.",
  },
  appointed: {
    heading: "Your appointment is confirmed",
    message: "Welcome to the work of building Aletheia. Your appointment will be published in the register of appointments on aletheiagov.org.",
  },
  not_progressed: {
    heading: "An update on your application",
    message:
      "Thank you for the time and care you gave to your application. On this occasion we will not be taking it further. Your registration stays on file, and we may contact you about other positions that match it.",
  },
};

/** To the person: their application moved to a status worth telling them about. Null for internal statuses. */
export function statusChanged(to: { fullName: string; email: string }, reference: string, status: ApplicationStatus): Mail | null {
  const s = STATUS[status];
  if (!s) return null;
  return renderLetter({
    to: to.email,
    subject: `Your application ${reference}: ${APPLICATION_STATUS_LABEL[status]}`,
    preheader: s.heading,
    kicker: `Application · ${APPLICATION_STATUS_LABEL[status]}`,
    heading: s.heading,
    greeting: `Dear ${to.fullName},`,
    paragraphs: [s.message],
    reference: { label: "Your reference", value: reference },
    signature: SIGNATURE,
    site: SITE,
  });
}
