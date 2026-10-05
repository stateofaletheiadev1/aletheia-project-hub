import { pdfResponse } from '@/lib/pdf/response';
import { PDF_CATALOGUE, registerSpec } from '@/lib/pdf/specs';
import { getRegisterDocument } from '@/lib/documents';

export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_CATALOGUE.documents.map((id) => ({ id }));
}

export async function GET(_request: Request, { params }: RouteContext<'/pdf/documents/[id]'>) {
  const { id } = await params;
  const doc = getRegisterDocument(id);
  const spec = doc && registerSpec(doc);
  if (!doc || !spec) return new Response('Not found', { status: 404 });
  return pdfResponse(spec, doc.code);
}
