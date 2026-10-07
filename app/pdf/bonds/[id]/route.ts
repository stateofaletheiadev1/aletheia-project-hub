import { pdfResponse } from '@/lib/pdf/response';
import { PDF_CATALOGUE, bondSpec } from '@/lib/pdf/specs';
import { getBond } from '@/lib/bonds';

export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_CATALOGUE.bonds.map((id) => ({ id }));
}

export async function GET(_request: Request, { params }: RouteContext<'/pdf/bonds/[id]'>) {
  const { id } = await params;
  const bond = getBond(id);
  if (!bond) return new Response('Not found', { status: 404 });
  return pdfResponse(bondSpec(bond), `${bond.id.toUpperCase()}_Information-Memorandum`);
}
