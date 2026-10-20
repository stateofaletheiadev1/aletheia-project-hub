import { body, clientIp, fail, isEmail, json, rateLimit, route, str } from '@/lib/server/http';
import { databaseConfigured } from '@/lib/server/db';
import { registerInterest } from '@/lib/server/interest';

// Founding-member interest. Free, and nothing is sold: name, email, country, an optional
// note, and explicit consent. No identity documents and no payment are ever accepted here.
export const POST = route(async (req) => {
  rateLimit(`interest:${clientIp(req)}`, 5, 60 * 60_000);
  if (!databaseConfigured()) fail(503, 'Registration is not available at the moment. Please write to us through the contact page instead.');
  const b = await body(req, 8 * 1024);
  if (b.consent !== true) fail(400, 'Please confirm that you agree to us storing your details.');
  // A hidden field people do not see; automated submissions tend to fill it.
  if (typeof b.website === 'string' && b.website.trim()) return json({ ok: true }, 201);
  const name = str(b, 'name', { max: 120, label: 'Name' });
  const email = str(b, 'email', { max: 254, label: 'Email' });
  if (!isEmail(email)) fail(400, 'Enter a valid email address.');
  const country = str(b, 'country', { max: 80, label: 'Country' });
  const contribution = str(b, 'contribution', { max: 1000, optional: true, label: 'How you would like to contribute' });
  const result = await registerInterest({ name, email, country, contribution });
  return json({ ok: true, result }, result === 'created' ? 201 : 200);
});
