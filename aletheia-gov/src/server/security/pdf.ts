import "server-only";

// Upload checks for CVs (brief §10.6): the file is judged by its bytes, never by its name
// or the browser's claimed type. PDFs that can run code or carry other files are refused,
// to protect the officers who open them.

const RISKY = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia", "/XFA"];

export type PdfCheck = { ok: true } | { ok: false; reason: string };

export function checkPdf(bytes: Uint8Array, maxBytes: number): PdfCheck {
  if (bytes.length === 0) return { ok: false, reason: "The file is empty." };
  if (bytes.length > maxBytes) return { ok: false, reason: `The CV must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.` };
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (head !== "%PDF-") return { ok: false, reason: "The CV must be a PDF file." };
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 2048))).toString("latin1");
  if (!tail.includes("%%EOF")) return { ok: false, reason: "The PDF looks incomplete or damaged." };
  const text = Buffer.from(bytes).toString("latin1");
  const found = RISKY.find((marker) => new RegExp(`${marker.replace("/", "\\/")}(?![A-Za-z])`).test(text));
  if (found) return { ok: false, reason: "This PDF contains scripts or embedded content and cannot be accepted. Please export a plain PDF." };
  return { ok: true };
}
