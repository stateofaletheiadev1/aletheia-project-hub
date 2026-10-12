import { json, route } from '@/lib/server/http';
import { clearSessionCookie, endSession } from '@/lib/server/sessions';

export const POST = route(async (req) => {
  await endSession('citizen', req);
  const res = json({ ok: true });
  clearSessionCookie(res, 'citizen');
  return res;
});
