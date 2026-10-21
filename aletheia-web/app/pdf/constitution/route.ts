import { constitutionPdfResponse } from '@/lib/pdf/constitution-response';

export const dynamic = 'force-static';

export async function GET() {
  return constitutionPdfResponse();
}
