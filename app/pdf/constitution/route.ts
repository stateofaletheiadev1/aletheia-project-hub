import { pdfResponse } from '@/lib/pdf/response';
import { constitutionSpec } from '@/lib/pdf/specs';

export const dynamic = 'force-static';

export async function GET() {
  return pdfResponse(constitutionSpec(), 'CONST-2026-01_Covenant-of-Aletheia');
}
