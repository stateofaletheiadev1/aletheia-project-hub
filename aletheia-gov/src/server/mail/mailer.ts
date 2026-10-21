import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/config/env";

// Outgoing email through the founding team's mail provider (Zoho Mail), configured by environment:
//   SMTP_HOST (default smtp.zoho.com), SMTP_PORT (default 465), SMTP_USER, SMTP_PASS,
//   MAIL_FROM (default "The Government of Aletheia <no-reply@stateofaletheia.org>"),
//   MAIL_NOTIFY (where the team is told of new registrations; default info@stateofaletheia.org).
// Without SMTP_USER and SMTP_PASS nothing is sent and nothing fails: sending is a courtesy, the
// record is what counts. A failed send is retried once and then logged, never shown to the person.

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };

let transport: Transporter | null | undefined;

function transporter(): Transporter | null {
  if (transport !== undefined) return transport;
  const e = env();
  if (!e.SMTP_USER || !e.SMTP_PASS) return (transport = null);
  transport = nodemailer.createTransport({
    host: e.SMTP_HOST ?? "smtp.zoho.com",
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  return transport;
}

export function mailConfigured(): boolean {
  return transporter() !== null;
}

export function notifyAddress(): string {
  return env().MAIL_NOTIFY ?? "info@stateofaletheia.org";
}

/** Sends one message. Returns whether it was accepted by the mail server. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = transporter();
  if (!t) return false;
  const from = env().MAIL_FROM ?? "The Government of Aletheia <no-reply@stateofaletheia.org>";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await t.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, replyTo: mail.replyTo ?? "info@stateofaletheia.org" });
      return true;
    } catch (e) {
      if (attempt === 2) console.error(`[mail] could not send "${mail.subject}": ${String(e).slice(0, 200)}`);
    }
  }
  return false;
}
