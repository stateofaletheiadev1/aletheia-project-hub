import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalText, EDITION } from '@/lib/constitution';
import { getRegisterDocument } from '@/lib/documents';
import { renderConstitutionPdf } from '@/lib/pdf/constitution';

/** SHA-256 of the canonical text of the current edition. */
export function constitutionFingerprint(): string {
  return createHash('sha256').update(canonicalText(), 'utf8').digest('hex');
}

/** The full draft Constitution as a PDF response. Fails the build if the public register records a stale fingerprint. */
export async function constitutionPdfResponse(): Promise<Response> {
  const fingerprint = constitutionFingerprint();
  const entry = getRegisterDocument('covenant-main');
  if (entry && (entry.hash !== fingerprint || entry.code !== EDITION.code)) {
    throw new Error(`Public register entry covenant-main is stale: expected ${EDITION.code} / ${fingerprint}, found ${entry.code} / ${entry.hash}`);
  }
  const arms = new Uint8Array(await readFile(path.join(process.cwd(), 'public', 'brand', 'arms-pdf.png')));
  const bytes = await renderConstitutionPdf({ arms, fingerprint });
  return new Response(new Blob([bytes as BlobPart], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${EDITION.code}_Constitution-of-Aletheia.pdf"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
