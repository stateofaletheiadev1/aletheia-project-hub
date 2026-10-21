import 'server-only';

// Emails sent to founding members and to the founding team. Plain words, no links asking for a
// password or payment, so a genuine message is easy to tell from an impersonation.

const SIGN_OFF = 'The Founding Team of the Sovereign Covenant State of Aletheia';
const FOOTER =
  'This message was sent automatically from no-reply@stateofaletheia.org, which does not receive replies. Write to info@stateofaletheia.org with any question. Aletheia never asks for payment, passwords or identity documents by email.';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function letter(to: string, subject: string, greeting: string, blocks: (string | string[])[]) {
  const text = [greeting, ...blocks.map((b) => (Array.isArray(b) ? b.map((x) => `  • ${x}`).join('\n') : b)), SIGN_OFF, '—', FOOTER].join('\n\n');
  const body = blocks
    .map((b) =>
      Array.isArray(b)
        ? `<ul style="margin:0 0 16px;padding-left:20px">${b.map((x) => `<li style="margin:4px 0">${escape(x)}</li>`).join('')}</ul>`
        : `<p style="margin:0 0 16px">${escape(b)}</p>`,
    )
    .join('');
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#F4EEDF;font-family:Arial,Helvetica,sans-serif;color:#15294A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EEDF"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #C49A4E">
<tr><td align="center" style="padding:28px 32px 4px"><img src="https://www.stateofaletheia.org/brand/email-arms.png" width="56" height="66" alt="Coat of arms of Aletheia" style="display:block;border:0;outline:none"></td></tr>
<tr><td align="center" style="padding:6px 32px 12px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8F6A2A">The Sovereign Covenant State of Aletheia<br><span style="letter-spacing:1px;text-transform:none;font-style:italic">Veritas in Foedere</span></td></tr>
<tr><td style="padding:8px 32px;font-size:15px;line-height:1.65">
<p style="margin:0 0 16px">${escape(greeting)}</p>${body}<p style="margin:0 0 4px">${SIGN_OFF}</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;line-height:1.5;color:#55627A;border-top:1px solid #E8DECA">${escape(FOOTER)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}

export type FoundingMember = { name: string; email: string; country: string; contribution: string };

/** To the person who registered. */
export function foundingMemberWelcome(m: FoundingMember) {
  return letter(m.email, 'Welcome to the founding community of Aletheia', `Dear ${m.name},`, [
    'Thank you for registering your interest as a founding member of the Sovereign Covenant State of Aletheia. Your registration has been recorded.',
    'What happens next:',
    [
      'We will write to you as the founding community forms, with news of the Constitution, the seastead and the first platform.',
      'When positions open in the founding government, they are published at aletheiagov.org/opportunities.',
      'Registering is free and creates no obligation. It does not confer citizenship, and nothing is sold.',
    ],
    'You may ask us to erase your details at any time by writing to info@stateofaletheia.org.',
  ]);
}

/** To the founding team. */
export function foundingMemberNotice(m: FoundingMember, notify: string) {
  return letter(notify, `New founding member: ${m.name} (${m.country})`, 'A new founding-member registration was recorded on stateofaletheia.org.', [
    [`Name: ${m.name}`, `Email: ${m.email}`, `Country: ${m.country}`, ...(m.contribution ? [`How they would like to contribute: ${m.contribution}`] : [])],
  ]);
}
