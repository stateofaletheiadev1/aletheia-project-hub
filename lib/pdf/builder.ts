import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';

/**
 * Official document renderer for the Covenant State. Pure pdf-lib, so the same
 * code produces PDFs in route handlers (server) and in the citizen portal
 * (browser). Every official PDF goes through `renderOfficialPdf`.
 */

export interface PdfSection {
  /** e.g. "Section 1", "Article 7", "1." */
  number?: string;
  heading?: string;
  paragraphs: string[];
}

export interface OfficialPdfSpec {
  /** Short code printed top-right, e.g. "ACT-2026-01". */
  code: string;
  /** Document class above the title, e.g. "Act of the Covenant Assembly". */
  kind: string;
  title: string;
  /** Key/value rows printed under the title. */
  meta: [string, string][];
  /** Italic lead paragraph (preamble, abstract, summary). */
  lead?: string;
  sections: PdfSection[];
  /** Closing attestation lines (signatory, seal). */
  attestation?: string[];
  /** Ledger hash printed in every footer, when the document is inscribed. */
  hash?: string;
  /** PNG bytes of the coat of arms for the letterhead. */
  arms?: Uint8Array;
  subject?: string;
}

const NAVY = rgb(0x15 / 255, 0x29 / 255, 0x4a / 255);
const GOLD = rgb(0xc4 / 255, 0x9a / 255, 0x4e / 255);
const GOLD_DARK = rgb(0x8f / 255, 0x6a / 255, 0x2a / 255);
const INK = rgb(0.16, 0.18, 0.22);
const MUTED = rgb(0.42, 0.45, 0.5);

const A4: [number, number] = [595.28, 841.89];
const MARGIN_X = 64;
const TOP = 780;
const BOTTOM = 78;

/** Standard PDF fonts are WinAnsi-encoded; map anything outside it to safe equivalents. */
export function toWinAnsi(text: string): string {
  const map: Record<string, string> = {
    '≤': '<=', '≥': '>=', '±': '+/-', '→': '->', '←': '<-', '↔': '<->', '×': 'x', '−': '-',
    '‑': '-', ' ': ' ', ' ': ' ', '✓': '', '●': '', '★': '*', '…': '...', '₂': '2',
    'Ω': 'Ohm', 'μ': 'u', '≈': '~', '·': '-',
  };
  return Array.from(text)
    .map((ch) => {
      if (map[ch] !== undefined) return map[ch];
      const code = ch.codePointAt(0)!;
      // Latin-1 plus the WinAnsi punctuation block (smart quotes, dashes, §, €).
      if (code < 0x100 || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(ch)) return ch;
      return '?';
    })
    .join('');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of toWinAnsi(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderOfficialPdf(spec: OfficialPdfSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(`${spec.code} — ${spec.title}`));
  doc.setAuthor('The Covenant State of Aletheia');
  doc.setCreator('stateofaletheia.org');
  doc.setProducer('Aletheia Official Gazette');
  doc.setSubject(toWinAnsi(spec.subject ?? spec.kind));
  doc.setLanguage('en-GB');

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arms: PDFImage | null = spec.arms ? await doc.embedPng(spec.arms) : null;

  const width = A4[0] - MARGIN_X * 2;
  let page: PDFPage = doc.addPage(A4);
  let y = TOP;

  const newPage = () => {
    page = doc.addPage(A4);
    y = TOP;
    // Running header on continuation pages.
    page.drawText(toWinAnsi(`${spec.code}  ·  ${spec.title}`.slice(0, 95)), { x: MARGIN_X, y: 806, size: 8, font: sans, color: MUTED });
    page.drawLine({ start: { x: MARGIN_X, y: 798 }, end: { x: A4[0] - MARGIN_X, y: 798 }, thickness: 0.5, color: GOLD });
  };

  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) newPage();
  };

  const text = (str: string, font: PDFFont, size: number, color = INK, leading = size * 1.45, indent = 0) => {
    for (const line of wrap(str, font, size, width - indent)) {
      ensure(leading);
      page.drawText(line, { x: MARGIN_X + indent, y, size, font, color });
      y -= leading;
    }
  };

  // ── Letterhead ──
  if (arms) {
    const dims = arms.scaleToFit(54, 64);
    page.drawImage(arms, { x: MARGIN_X, y: TOP - dims.height + 10, width: dims.width, height: dims.height });
  }
  const headX = MARGIN_X + (arms ? 68 : 0);
  page.drawText('THE COVENANT STATE OF ALETHEIA', { x: headX, y: TOP - 8, size: 12, font: sansBold, color: NAVY });
  page.drawText('Veritas in Foedere  ·  Official Gazette', { x: headX, y: TOP - 24, size: 9, font: serifItalic, color: GOLD_DARK });
  const codeW = sansBold.widthOfTextAtSize(toWinAnsi(spec.code), 10);
  page.drawText(toWinAnsi(spec.code), { x: A4[0] - MARGIN_X - codeW, y: TOP - 8, size: 10, font: sansBold, color: GOLD_DARK });
  y = TOP - 64;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: A4[0] - MARGIN_X, y }, thickness: 1.5, color: GOLD });
  y -= 30;

  // ── Title block ──
  text(spec.kind.toUpperCase(), sansBold, 8.5, GOLD_DARK, 14);
  y -= 4;
  text(spec.title, sansBold, 19, NAVY, 25);
  y -= 8;
  for (const [k, v] of spec.meta) {
    ensure(15);
    page.drawText(toWinAnsi(k), { x: MARGIN_X, y, size: 8.5, font: sansBold, color: MUTED });
    const lines = wrap(v, sans, 8.5, width - 130);
    lines.forEach((line, i) => {
      if (i > 0) { y -= 12; ensure(12); }
      page.drawText(line, { x: MARGIN_X + 130, y, size: 8.5, font: sans, color: INK });
    });
    y -= 15;
  }
  y -= 6;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: A4[0] - MARGIN_X, y }, thickness: 0.5, color: GOLD });
  y -= 24;

  // ── Lead ──
  if (spec.lead) {
    text(spec.lead, serifItalic, 11.5, INK, 17);
    y -= 14;
  }

  // ── Sections ──
  for (const s of spec.sections) {
    ensure(48);
    if (s.number || s.heading) {
      // "1." reads "1. Scope"; "Section 1" reads "Section 1 — Heading".
      const sep = s.number?.endsWith('.') ? ' ' : '  —  ';
      const label = [s.number, s.heading].filter(Boolean).join(sep);
      text(label, sansBold, 10.5, NAVY, 16);
      y -= 2;
    }
    for (const p of s.paragraphs) {
      text(p, serif, 11, INK, 16);
      y -= 6;
    }
    y -= 10;
  }

  // ── Attestation ──
  if (spec.attestation?.length) {
    ensure(30 + spec.attestation.length * 15);
    y -= 6;
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 200, y }, thickness: 0.8, color: NAVY });
    y -= 18;
    spec.attestation.forEach((line, i) => text(line, i === 0 ? sansBold : sans, 9.5, i === 0 ? NAVY : MUTED, 14));
  }

  // ── Footers on every page ──
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN_X, y: 52 }, end: { x: A4[0] - MARGIN_X, y: 52 }, thickness: 0.5, color: GOLD });
    const left = spec.hash ? `Ledger inscription ${spec.hash.slice(0, 26)}...` : 'stateofaletheia.org';
    p.drawText(toWinAnsi(left), { x: MARGIN_X, y: 38, size: 7.5, font: sans, color: MUTED });
    p.drawText('The English text is authoritative.', { x: MARGIN_X, y: 27, size: 7.5, font: serifItalic, color: MUTED });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: A4[0] - MARGIN_X - sans.widthOfTextAtSize(n, 7.5), y: 38, size: 7.5, font: sans, color: MUTED });
  });

  return doc.save();
}
