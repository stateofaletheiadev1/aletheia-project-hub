import { pdfResponse } from '@/lib/pdf/response';
import { PDF_CATALOGUE, gazetteSpec } from '@/lib/pdf/specs';
import { getGazettePost } from '@/lib/gazette';

export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_CATALOGUE.gazette.map((slug) => ({ slug }));
}

export async function GET(_request: Request, { params }: RouteContext<'/pdf/gazette/[slug]'>) {
  const { slug } = await params;
  const post = getGazettePost(slug);
  if (!post) return new Response('Not found', { status: 404 });
  return pdfResponse(gazetteSpec(post), post.number);
}
