import { body, fail, json, oneOf, route, str } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { lookupTraveller, recordCrossing } from '@/lib/server/registry';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const passport = (req.nextUrl.searchParams.get('passport') ?? '').trim();
  if (!passport || passport.length > 30) fail(400, 'Enter a passport number.');
  return json({ traveller: await lookupTraveller(passport) });
});

export const POST = route(async (req) => {
  const { officer } = await requireOfficer(req);
  const b = await body(req);
  await recordCrossing(str(b, 'passportNumber', { max: 30, label: 'Passport number' }), oneOf(b, 'decision', ['CLEARED', 'FLAGGED'] as const), officer);
  return json({ ok: true }, 201);
});
