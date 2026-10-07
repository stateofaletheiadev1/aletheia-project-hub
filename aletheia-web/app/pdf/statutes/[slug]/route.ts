import { pdfResponse } from '@/lib/pdf/response';
import { PDF_CATALOGUE, statuteSpec } from '@/lib/pdf/specs';
import { getStatute } from '@/lib/statutes';

export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_CATALOGUE.statutes.map((slug) => ({ slug }));
}

export async function GET(_request: Request, { params }: RouteContext<'/pdf/statutes/[slug]'>) {
  const { slug } = await params;
  const statute = getStatute(slug);
  if (!statute) return new Response('Not found', { status: 404 });
  return pdfResponse(statuteSpec(statute), statute.code);
}
