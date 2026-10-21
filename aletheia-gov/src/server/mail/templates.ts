import "server-only";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application-status";
import type { Mail } from "./mailer";

// The emails the founding government sends. Plain words, the reference first, and no link that
// asks for a password or payment, so a genuine message is easy to tell from an impersonation.

const SIGN_OFF = "The Founding Government of Aletheia";
const FOOTER =
  "This message was sent automatically from no-reply@stateofaletheia.org, which does not receive replies. Write to info@stateofaletheia.org with any question. The founding government never asks for payment, passwords or identity documents by email.";

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** One letter, as plain text and as simple HTML. Paragraphs are plain text; lists become bullet points. */
function letter(to: string, subject: string, greeting: string, blocks: (string | string[])[]): Mail {
  const text = [greeting, ...blocks.map((b) => (Array.isArray(b) ? b.map((x) => `  • ${x}`).join("\n") : b)), SIGN_OFF, "—", FOOTER].join("\n\n");
  const body = blocks
    .map((b) =>
      Array.isArray(b)
        ? `<ul style="margin:0 0 16px;padding-left:20px">${b.map((x) => `<li style="margin:4px 0">${escape(x)}</li>`).join("")}</ul>`
        : `<p style="margin:0 0 16px">${escape(b)}</p>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#F4EEDF;font-family:Georgia,'Times New Roman',serif;color:#15294A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EEDF"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #C49A4E">
<tr><td align="center" style="padding:28px 32px 4px"><img src="https://www.aletheiagov.org/brand/email-arms.png" width="56" height="66" alt="Coat of arms of Aletheia" style="display:block;border:0;outline:none"></td></tr>
<tr><td align="center" style="padding:6px 32px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8F6A2A">The Government of Aletheia<br><span style="letter-spacing:1px;text-transform:none;font-style:italic">Veritas in Foedere</span></td></tr>
<tr><td style="padding:8px 32px 8px;font-size:16px;line-height:1.6">
<p style="margin:0 0 16px">${escape(greeting)}</p>${body}<p style="margin:0 0 4px">${SIGN_OFF}</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#55627A;border-top:1px solid #E8DECA">${escape(FOOTER)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}

export type RegistrationSummary = {
  fullName: string;
  email: string;
  reference: string;
  /** Title and reference of the published position applied for, if any. */
  position?: { title: string; reference: string };
  institutions: string[];
  positionTypes: string[];
};

/** To the person: their registration or application was received. */
export function registrationReceived(r: RegistrationSummary): Mail {
  const subject = r.position ? `Application received: ${r.position.title} (${r.reference})` : `Registration of interest received (${r.reference})`;
  const what: string[] = [];
  if (r.position) what.push(`Position: ${r.position.title} (${r.position.reference})`);
  if (r.institutions.length) what.push(`Institutions: ${r.institutions.join(", ")}`);
  if (r.positionTypes.length) what.push(`Kinds of position: ${r.positionTypes.join(", ")}`);
  return letter(r.email, subject, `Dear ${r.fullName},`, [
    r.position
      ? `Thank you for applying to serve the Sovereign Covenant State of Aletheia. We have received your application, and your reference is ${r.reference}.`
      : `Thank you for registering your interest in serving the Sovereign Covenant State of Aletheia. We have received your registration, and your reference is ${r.reference}.`,
    "You registered for:",
    what,
    r.position
      ? "The founding team reviews every application. We will email you when the status of your application changes."
      : "We will contact you when a position matching your registration is published. If you apply for a published position, we will email you as your application progresses.",
    "To add to your registration, register again with the same email address. Your details are kept for twelve months after your latest registration, and you may ask us to erase them at any time.",
  ]);
}

/** To the founding team: a new registration to look at. */
export function registrationNotice(r: RegistrationSummary, notify: string): Mail {
  return letter(notify, `New ${r.position ? "application" : "registration"} ${r.reference}${r.position ? `: ${r.position.title}` : ""}`, "A new registration was recorded on aletheiagov.org.", [
    [
      `Reference: ${r.reference}`,
      `Name: ${r.fullName}`,
      `Email: ${r.email}`,
      ...(r.position ? [`Position: ${r.position.title} (${r.position.reference})`] : []),
      ...(r.institutions.length ? [`Institutions: ${r.institutions.join(", ")}`] : []),
      ...(r.positionTypes.length ? [`Kinds of position: ${r.positionTypes.join(", ")}`] : []),
    ],
    "Review it in the operations workbench.",
  ]);
}

const STATUS_MESSAGE: Partial<Record<ApplicationStatus, string>> = {
  contacted: "A member of the founding team will be in touch with you about your application shortly, from one of the addresses published on aletheiagov.org/contact.",
  shortlisted: "We are pleased to tell you that you have been shortlisted. The founding team will write to you about the next step.",
  offered: "We are pleased to tell you that the founding team would like to offer you the position. We will write to you with the details of the offer.",
  appointed: "Your appointment is confirmed. Welcome to the work of building Aletheia. Appointments are published in the register of appointments on aletheiagov.org.",
  not_progressed:
    "Thank you for the time you gave to your application. On this occasion we will not be taking it further. Your registration stays on file, and we may contact you about other positions that match it.",
};

/** To the person: their application moved to a status worth telling them about. Null for internal statuses. */
export function statusChanged(to: { fullName: string; email: string }, reference: string, status: ApplicationStatus): Mail | null {
  const message = STATUS_MESSAGE[status];
  if (!message) return null;
  return letter(to.email, `Your application ${reference}: ${APPLICATION_STATUS_LABEL[status]}`, `Dear ${to.fullName},`, [
    `There is an update on your application, reference ${reference}.`,
    message,
  ]);
}
