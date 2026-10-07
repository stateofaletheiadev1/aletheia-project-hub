import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderOfficialPdf, type OfficialPdfSpec } from '@/lib/pdf/builder';

let armsCache: Uint8Array | null = null;

async function arms(): Promise<Uint8Array> {
  armsCache ??= new Uint8Array(await readFile(path.join(process.cwd(), 'public', 'brand', 'arms-pdf.png')));
  return armsCache;
}

/** Renders a spec and returns it as an inline PDF response with a meaningful filename. */
export async function pdfResponse(spec: Omit<OfficialPdfSpec, 'arms'>, filename: string): Promise<Response> {
  const bytes = await renderOfficialPdf({ ...spec, arms: await arms() });
  return new Response(new Blob([bytes as BlobPart], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}.pdf"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
