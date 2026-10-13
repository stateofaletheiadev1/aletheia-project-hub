import { NextResponse } from 'next/server';
import { fail, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { documents, readFile } from '@/lib/server/documents';

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireOfficer(req);
  const { id } = await params;
  const doc = await documents().findById(id);
  if (!doc) return fail(404, 'No such document.');
  const { bytes, name } = await readFile(doc);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': doc.contentType,
      'content-disposition': `attachment; filename="${name.replace(/[^\w.\- ]/g, '_')}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});
