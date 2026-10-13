import { body, fail, json, route } from '@/lib/server/http';
import { getSettings, requireOfficer, saveSettings } from '@/lib/server/officers';
import { audit } from '@/lib/server/records';

export const GET = route(async (req) => {
  await requireOfficer(req);
  return json({ settings: await getSettings() });
});

export const PATCH = route(async (req) => {
  const { officer } = await requireOfficer(req, { administrator: true });
  const minutes = Number((await body(req)).sessionTimeoutMinutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) fail(400, 'The session timeout must be between 5 and 240 minutes.');
  await saveSettings({ sessionTimeoutMinutes: minutes }, officer.officerId);
  await audit({ category: 'Security', actor: officer.officerId, actorId: officer._id, action: `Officer session timeout set to ${minutes} minutes` });
  return json({ settings: await getSettings() });
});
