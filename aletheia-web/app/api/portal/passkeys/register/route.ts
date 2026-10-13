import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { body, json, route, str } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { listPasskeys, register, registrationOptions } from '@/lib/server/passkeys';

/** Step 1: options for navigator.credentials.create(). */
export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json({ options: await registrationOptions(req, account) });
});

/** Step 2: the browser's response; saves the passkey. */
export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  const b = await body<{ response: RegistrationResponseJSON; label?: string }>(req);
  await register(req, account, b.response, str(b as Record<string, unknown>, 'label', { max: 60, optional: true }));
  return json({ passkeys: await listPasskeys(account._id) }, 201);
});
