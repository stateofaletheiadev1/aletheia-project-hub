import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { toWinAnsi } from '@/lib/pdf/builder';
import { CONSTITUTION, CHANGELOG, EDITION, type Clause } from '@/lib/constitution';

/**
 * The full draft Constitution as a PDF: title page, a complete table of contents with
 * page numbers, the Preamble, every Part, Article and Schedule, and the edition history.
 * The body is laid out first; the contents pages are then inserted after the title page,
 * so every page number in the contents is the page the entry actually starts on.
 */

const NAVY = rgb(0x15 / 255, 0x29 / 255, 0x4a / 255);
const GOLD = rgb(0xc4 / 255, 0x9a / 255, 0x4e / 255);
const GOLD_DARK = rgb(0x8f / 255, 0x6a / 255, 0x2a / 255);
const INK = rgb(0.13, 0.15, 0.2);
const MUTED = rgb(0.42, 0.45, 0.5);

const A4: [number, number] = [595.28, 841.89];
const MX = 64;
const TOP = 780;
const BOTTOM = 80;
const WIDTH = A4[0] - MX * 2;

const DISCLAIMER =
  'This is a proposed Constitution, published for consultation. It has no legal force. It describes the State that Aletheia intends to become; Aletheia is not a recognised state, holds no territory and exercises no legal authority, and the institutions named in this text do not yet exist. The Constitution will enter into force only when the conditions of its own Article on entry into force are met.';

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of toWinAnsi(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

interface TocEntry {
  label: string;
  level: 0 | 1;
  page: number; // physical index before the contents pages are inserted
}

export async function renderConstitutionPdf(opts: { arms?: Uint8Array; fingerprint: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(`${EDITION.code} — The Constitution of the Sovereign Covenant State of Aletheia (Draft)`));
  doc.setAuthor('The Sovereign Covenant State of Aletheia — founding team');
  doc.setSubject('Draft Constitution, edition ' + EDITION.edition);
  doc.setCreator('stateofaletheia.org');
  doc.setProducer('Aletheia Founding-Phase Platform');
  doc.setLanguage('en-GB');
  doc.setKeywords(['Aletheia', 'Constitution', 'draft', EDITION.code]);

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arms = opts.arms ? await doc.embedPng(opts.arms) : null;

  let page: PDFPage = doc.addPage(A4);
  let y = TOP;
  const toc: TocEntry[] = [];

  const newPage = () => {
    page = doc.addPage(A4);
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };
  const lines = (str: string, font: PDFFont, size: number, color = INK, leading = size * 1.42, indent = 0, hang = 0) => {
    const ls = wrap(str, font, size, WIDTH - indent - hang);
    ls.forEach((l, i) => {
      ensure(leading);
      page.drawText(l, { x: MX + indent + (i === 0 ? 0 : hang), y, size, font, color });
      y -= leading;
    });
  };

  // ── Title page ──
  if (arms) {
    const d = arms.scaleToFit(96, 112);
    page.drawImage(arms, { x: (A4[0] - d.width) / 2, y: TOP - d.height, width: d.width, height: d.height });
    y = TOP - d.height - 34;
  } else y = TOP - 40;
  const centre = (s: string, font: PDFFont, size: number, color = NAVY) => {
    for (const l of wrap(s, font, size, WIDTH)) {
      const w = font.widthOfTextAtSize(l, size);
      page.drawText(l, { x: (A4[0] - w) / 2, y, size, font, color });
      y -= size * 1.35;
    }
  };
  centre('THE SOVEREIGN COVENANT STATE OF ALETHEIA', sansBold, 11, GOLD_DARK);
  y -= 14;
  centre('The Constitution of the Sovereign Covenant State of Aletheia', sansBold, 22);
  y -= 4;
  centre('The Covenant of Aletheia', serifItalic, 15, GOLD_DARK);
  y -= 6;
  centre('Veritas in Foedere', serifItalic, 11, MUTED);
  y -= 22;
  page.drawLine({ start: { x: MX, y }, end: { x: A4[0] - MX, y }, thickness: 1.2, color: GOLD });
  y -= 26;

  const meta: [string, string][] = [
    ['Reference', EDITION.code],
    ['Edition', `${EDITION.edition} — ${EDITION.status}`],
    ['Revised', new Date(`${EDITION.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })],
    ['Contents', `Preamble, ${CONSTITUTION.parts.length} Parts, ${CONSTITUTION.articles.length} Articles, ${CONSTITUTION.schedules.length} Schedules`],
    ['Authoritative text', 'English'],
    ['Text fingerprint', `SHA-256 ${opts.fingerprint}`],
  ];
  for (const [k, v] of meta) {
    page.drawText(toWinAnsi(k), { x: MX, y, size: 9, font: sansBold, color: MUTED });
    const vs = wrap(v, sans, 9, WIDTH - 130);
    vs.forEach((l, i) => {
      page.drawText(l, { x: MX + 130, y: y - i * 12, size: 9, font: sans, color: INK });
    });
    y -= 12 * vs.length + 6;
  }
  y -= 18;
  // Status box.
  const boxLines = wrap(DISCLAIMER, serif, 10.5, WIDTH - 32);
  const boxH = 30 + boxLines.length * 15;
  page.drawRectangle({ x: MX, y: y - boxH, width: WIDTH, height: boxH, color: rgb(0.965, 0.95, 0.915), borderColor: GOLD, borderWidth: 0.8 });
  page.drawText('DRAFT — NO LEGAL FORCE', { x: MX + 16, y: y - 18, size: 8.5, font: sansBold, color: GOLD_DARK });
  boxLines.forEach((l, i) => page.drawText(l, { x: MX + 16, y: y - 36 - i * 15, size: 10.5, font: serif, color: INK }));

  // ── Body ──
  newPage();
  const partHeading = (kicker: string, title: string) => {
    page.drawText(toWinAnsi(kicker.toUpperCase()), { x: MX, y, size: 9, font: sansBold, color: GOLD_DARK });
    y -= 22;
    lines(title, sansBold, 17, NAVY, 22);
    y -= 2;
    page.drawLine({ start: { x: MX, y }, end: { x: A4[0] - MX, y }, thickness: 1.2, color: GOLD });
    y -= 22;
  };

  toc.push({ label: 'Preamble', level: 0, page: doc.getPageCount() - 1 });
  partHeading('The Constitution', 'Preamble');
  CONSTITUTION.preamble.forEach((p, i) => {
    lines(p, i === CONSTITUTION.preamble.length - 1 ? serifItalic : serif, 11.5, INK, 17);
    y -= 7;
  });
  y -= 4;
  lines(CONSTITUTION.preambleNote, serifItalic, 9.5, MUTED, 13.5);

  const clauseBlock = (cls: Clause[], numbered: 'paren' | 'dot') => {
    for (const c of cls) {
      const label = numbered === 'paren' ? `(${c.n})` : `${c.n}.`;
      ensure(15);
      page.drawText(label, { x: MX, y, size: 10.5, font: serifBold, color: GOLD_DARK });
      lines(c.text, serif, 10.5, INK, 14.6, 30);
      (c.items ?? []).forEach((it, i) => {
        ensure(14.6);
        page.drawText(`(${String.fromCharCode(97 + i)})`, { x: MX + 30, y, size: 10.5, font: serif, color: GOLD_DARK });
        lines(it, serif, 10.5, INK, 14.6, 54);
      });
      y -= 4;
    }
  };

  for (const p of CONSTITUTION.parts) {
    newPage();
    toc.push({ label: `Part ${p.numeral} — ${p.title}`, level: 0, page: doc.getPageCount() - 1 });
    partHeading(`Part ${p.numeral}`, p.title);
    for (const c of p.chapters) {
      ensure(60);
      y -= 4;
      page.drawText(toWinAnsi(c.title.toUpperCase()), { x: MX, y, size: 8.5, font: sansBold, color: GOLD_DARK });
      y -= 18;
      for (const a of c.articles) {
        ensure(52);
        toc.push({ label: `Article ${a.number}. ${a.title}`, level: 1, page: doc.getPageCount() - 1 });
        lines(`Article ${a.number}.  ${a.title}`, sansBold, 11, NAVY, 15);
        y -= 3;
        clauseBlock(a.clauses, 'paren');
        y -= 8;
      }
    }
  }

  newPage();
  toc.push({ label: 'Schedules', level: 0, page: doc.getPageCount() - 1 });
  partHeading('Schedules', 'Schedules to the Constitution');
  for (const s of CONSTITUTION.schedules) {
    ensure(70);
    toc.push({ label: `Schedule ${s.number}. ${s.title}`, level: 1, page: doc.getPageCount() - 1 });
    lines(`Schedule ${s.number}.  ${s.title}`, sansBold, 12, NAVY, 16);
    lines(`Gives effect to ${s.basis.map((a) => `Article ${a.number}`).join(', ')}.`, serifItalic, 9.5, MUTED, 13);
    y -= 4;
    for (const sec of s.sections) {
      ensure(40);
      page.drawText(toWinAnsi(sec.heading.toUpperCase()), { x: MX, y, size: 8.5, font: sansBold, color: GOLD_DARK });
      y -= 16;
      clauseBlock(sec.clauses, 'dot');
      y -= 4;
    }
    y -= 12;
  }

  ensure(120);
  y -= 10;
  toc.push({ label: 'Edition history', level: 0, page: doc.getPageCount() - 1 });
  lines('Edition history', sansBold, 13, NAVY, 18);
  y -= 2;
  for (const c of CHANGELOG) {
    lines(`Edition ${c.edition} (${c.date})`, sansBold, 9.5, GOLD_DARK, 13);
    lines(c.summary, serif, 10, INK, 14);
    y -= 6;
  }

  // ── Contents pages, inserted after the title page ──
  const TOC_LEAD = 13.2;
  const tocTop = TOP - 46;
  const perPage = Math.floor((tocTop - BOTTOM) / TOC_LEAD);
  const tocPages = Math.ceil(toc.length / perPage);
  for (let i = 0; i < tocPages; i++) {
    const tp = doc.insertPage(1 + i, A4);
    let ty = TOP;
    if (i === 0) {
      tp.drawText('CONTENTS', { x: MX, y: ty, size: 9, font: sansBold, color: GOLD_DARK });
      tp.drawLine({ start: { x: MX, y: ty - 10 }, end: { x: A4[0] - MX, y: ty - 10 }, thickness: 1.2, color: GOLD });
    }
    ty = tocTop;
    for (const e of toc.slice(i * perPage, (i + 1) * perPage)) {
      const font = e.level === 0 ? sansBold : serif;
      const size = e.level === 0 ? 9 : 9.5;
      const indent = e.level === 0 ? 0 : 14;
      const num = String(e.page + tocPages + 1);
      const numW = sans.widthOfTextAtSize(num, 9);
      let label = toWinAnsi(e.label);
      const room = WIDTH - indent - numW - 18;
      while (font.widthOfTextAtSize(label, size) > room && label.length > 4) label = label.slice(0, -2);
      if (label !== toWinAnsi(e.label)) label = label.trimEnd() + '...';
      tp.drawText(label, { x: MX + indent, y: ty, size, font, color: e.level === 0 ? NAVY : INK });
      const dotsFrom = MX + indent + font.widthOfTextAtSize(label, size) + 6;
      const dotsTo = A4[0] - MX - numW - 6;
      for (let x = dotsFrom; x < dotsTo; x += 4) tp.drawText('.', { x, y: ty, size: 8, font: sans, color: MUTED });
      tp.drawText(num, { x: A4[0] - MX - numW, y: ty, size: 9, font: sans, color: INK });
      ty -= TOC_LEAD;
    }
  }

  // ── Running header and footer ──
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (i > 0) {
      p.drawText(toWinAnsi(`The Constitution of Aletheia  ·  Draft edition ${EDITION.edition}`), { x: MX, y: 806, size: 8, font: sans, color: MUTED });
      p.drawLine({ start: { x: MX, y: 798 }, end: { x: A4[0] - MX, y: 798 }, thickness: 0.5, color: GOLD });
    }
    p.drawLine({ start: { x: MX, y: 54 }, end: { x: A4[0] - MX, y: 54 }, thickness: 0.5, color: GOLD });
    p.drawText(toWinAnsi(`${EDITION.code}  ·  Draft for consultation  ·  No legal force`), { x: MX, y: 40, size: 7.5, font: sans, color: MUTED });
    p.drawText('Aletheia is not a recognised state. The English text is authoritative.', { x: MX, y: 29, size: 7.5, font: serifItalic, color: MUTED });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: A4[0] - MX - sans.widthOfTextAtSize(n, 7.5), y: 40, size: 7.5, font: sans, color: MUTED });
  });

  return doc.save();
}
