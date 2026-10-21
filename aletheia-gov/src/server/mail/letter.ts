import "server-only";

// The house letter: a navy letterhead with the arms, a parchment sheet, a framed reference and a
// signed close. Table layout and inline styles only, so it renders the same in Gmail, Outlook,
// Apple Mail and on phones. Every letter also carries a plain-text version.

export type Letter = {
  to: string;
  subject: string;
  /** Hidden preview line shown by mail clients next to the subject. */
  preheader: string;
  /** Small capitals above the heading, e.g. "Founding Community". */
  kicker: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  /** Framed reference panel, e.g. { label: 'Your reference', value: 'AGV-INT-2026-0042' }. */
  reference?: { label: string; value: string };
  /** Label and value rows under a small title. */
  details?: { title: string; rows: [string, string][] };
  /** Numbered steps under a small title. */
  steps?: { title: string; items: string[] };
  closing?: string[];
  signature: { name: string; role: string };
  /** Closing line above the signature; null for automatic notices. */
  valediction?: string | null;
  /** Where the letterhead links and which arms image it shows. */
  site: { name: string; url: string; host: string; arms: string };
};

const NAVY = '#15294A';
const NAVY_DEEP = '#0E1B31';
const GOLD = '#C49A4E';
const GOLD_INK = '#7A5A22';
const PARCHMENT = '#F4EEDF';
const PAPER = '#FFFDF8';
const INK = '#1E2A3D';
const MUTED = '#5E6A7D';
const RULE = '#E6DCC6';
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const FOOTER_NOTE =
  'Sent from no-reply@stateofaletheia.org, which does not receive replies. Write to info@stateofaletheia.org. Aletheia never asks for payment, passwords or identity documents by email.';

export function renderLetter(l: Letter): { to: string; subject: string; html: string; text: string } {
  const para = (t: string) => `<p style="margin:0 0 18px;font-family:${SERIF};font-size:17px;line-height:1.7;color:${INK};">${esc(t)}</p>`;
  const smallCaps = (t: string, color = GOLD_INK) =>
    `<p style="margin:8px 0 14px;font-family:${SANS};font-size:11px;line-height:1.4;letter-spacing:2.4px;text-transform:uppercase;font-weight:bold;color:${color};">${esc(t)}</p>`;

  const reference = l.reference
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 30px;">
<tr><td style="border:1px solid ${GOLD};padding:3px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:1px solid ${RULE};background:${PARCHMENT};padding:18px 16px;">
<p style="margin:0 0 6px;font-family:${SANS};font-size:10px;letter-spacing:2.6px;text-transform:uppercase;font-weight:bold;color:${GOLD_INK};">${esc(l.reference.label)}</p>
<p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:20px;letter-spacing:2px;font-weight:bold;color:${NAVY};">${esc(l.reference.value)}</p>
</td></tr></table>
</td></tr></table>`
    : '';

  const details = l.details
    ? `${smallCaps(l.details.title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px;border-top:1px solid ${RULE};">
${l.details.rows
  .map(
    ([k, v]) => `<tr>
<td valign="top" width="34%" style="padding:12px 12px 12px 0;border-bottom:1px solid ${RULE};font-family:${SANS};font-size:12px;letter-spacing:0.6px;color:${MUTED};">${esc(k)}</td>
<td valign="top" style="padding:12px 0;border-bottom:1px solid ${RULE};font-family:${SERIF};font-size:16px;line-height:1.5;color:${INK};">${esc(v)}</td>
</tr>`,
  )
  .join('\n')}
</table>`
    : '';

  const steps = l.steps
    ? `${smallCaps(l.steps.title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
${l.steps.items
  .map(
    (s, i) => `<tr>
<td valign="top" width="40" style="padding:2px 0 16px;font-family:${SERIF};font-size:22px;line-height:1.2;font-style:italic;color:${GOLD};">${['I', 'II', 'III', 'IV', 'V'][i] ?? i + 1}</td>
<td valign="top" style="padding:4px 0 16px;font-family:${SERIF};font-size:16px;line-height:1.65;color:${INK};">${esc(s)}</td>
</tr>`,
  )
  .join('\n')}
</table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(l.subject)}</title>
<style>
  @media (max-width: 620px) {
    .sheet { padding: 34px 24px 30px !important; }
    .head { padding: 34px 20px 28px !important; }
    .h1 { font-size: 27px !important; }
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .mark { letter-spacing: 2.2px !important; font-size: 10px !important; }
    .links { letter-spacing: 1.2px !important; }
  }
  a { color: ${NAVY}; }
</style>
</head>
<body style="margin:0;padding:0;background:${PARCHMENT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PARCHMENT};">${esc(l.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PARCHMENT};">
<tr><td align="center" style="padding:36px 12px 40px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

<tr><td class="head" align="center" style="background:${NAVY};background-image:linear-gradient(180deg,${NAVY} 0%,${NAVY_DEEP} 100%);padding:40px 32px 32px;border-top:3px solid ${GOLD};">
<a href="${l.site.url}" style="text-decoration:none;"><img src="${l.site.arms}" width="96" height="112" alt="Coat of arms of the Sovereign Covenant State of Aletheia" style="display:block;margin:0 auto 20px;border:0;outline:none;width:96px;height:auto;"></a>
<p class="mark" style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:3.6px;text-transform:uppercase;font-weight:bold;color:${GOLD};">${esc(l.site.name)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 12px;"><tr>
<td width="44" style="border-top:1px solid ${GOLD};font-size:0;line-height:0;">&nbsp;</td>
<td style="padding:0 10px;font-family:${SERIF};font-size:12px;line-height:1;color:${GOLD};">&#10022;</td>
<td width="44" style="border-top:1px solid ${GOLD};font-size:0;line-height:0;">&nbsp;</td>
</tr></table>
<p style="margin:0;font-family:${SERIF};font-size:15px;font-style:italic;letter-spacing:0.5px;color:#E9DFC7;">Veritas in Foedere</p>
</td></tr>

<tr><td class="sheet" style="background:${PAPER};padding:46px 52px 40px;border-left:1px solid ${RULE};border-right:1px solid ${RULE};">
${smallCaps(l.kicker)}
<h1 class="h1" style="margin:0 0 26px;font-family:${SERIF};font-size:31px;line-height:1.22;font-weight:normal;color:${NAVY};">${esc(l.heading)}</h1>
<p style="margin:0 0 18px;font-family:${SERIF};font-size:17px;line-height:1.7;color:${INK};">${esc(l.greeting)}</p>
${l.paragraphs.map(para).join('\n')}
${reference}
${details}
${steps}
${(l.closing ?? []).map(para).join('\n')}
${l.valediction === null ? '' : `<p style="margin:30px 0 2px;font-family:${SERIF};font-size:17px;line-height:1.5;color:${INK};">${esc(l.valediction ?? 'With every good wish,')}</p>`}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 10px;"><tr><td width="36" style="border-top:2px solid ${GOLD};font-size:0;line-height:0;">&nbsp;</td></tr></table>
<p style="margin:0;font-family:${SERIF};font-size:22px;font-style:italic;color:${NAVY};">${esc(l.signature.name)}</p>
<p style="margin:4px 0 0;font-family:${SANS};font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:${MUTED};">${esc(l.signature.role)}</p>
</td></tr>

<tr><td class="pad" style="background:${PAPER};padding:0 52px;border-left:1px solid ${RULE};border-right:1px solid ${RULE};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${RULE};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table></td></tr>
<tr><td class="pad" style="background:${PAPER};padding:20px 52px 34px;border-left:1px solid ${RULE};border-right:1px solid ${RULE};border-bottom:1px solid ${RULE};">
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.65;color:${MUTED};">${esc(FOOTER_NOTE)}</p>
</td></tr>

<tr><td align="center" style="padding:24px 20px 0;">
<p class="links" style="margin:0 0 6px;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD_INK};">
<a href="https://stateofaletheia.org" style="color:${GOLD_INK};text-decoration:none;">stateofaletheia.org</a>
&nbsp;&middot;&nbsp;
<a href="https://aletheiagov.org" style="color:${GOLD_INK};text-decoration:none;">aletheiagov.org</a>
</p>
<p style="margin:0;font-family:${SERIF};font-size:12px;font-style:italic;color:${MUTED};">The Sovereign Covenant State of Aletheia</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    l.site.name.toUpperCase(),
    'Veritas in Foedere',
    '',
    l.heading,
    '',
    l.greeting,
    '',
    ...l.paragraphs.flatMap((p) => [p, '']),
    ...(l.reference ? [`${l.reference.label}: ${l.reference.value}`, ''] : []),
    ...(l.details ? [l.details.title, ...l.details.rows.map(([k, v]) => `  ${k}: ${v}`), ''] : []),
    ...(l.steps ? [l.steps.title, ...l.steps.items.map((s, i) => `  ${i + 1}. ${s}`), ''] : []),
    ...(l.closing ?? []).flatMap((p) => [p, '']),
    ...(l.valediction === null ? [] : [l.valediction ?? 'With every good wish,', '']),
    l.signature.name,
    l.signature.role,
    '',
    '—',
    FOOTER_NOTE,
  ].join('\n');

  return { to: l.to, subject: l.subject, html, text };
}
