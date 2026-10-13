import { body, fail, json, route } from '@/lib/server/http';
import { officerView, requireOfficer, setOfficerDisabled } from '@/lib/server/officers';

/** Disables or re-enables an officer (administrators only). A disabled officer is signed out at once. */
export const PATCH = route<{ params: Promise<{ officerId: string }> }>(async (req, { params }) => {
  const { officer } = await requireOfficer(req, { administrator: true });
  const { officerId } = await params;
  const b = await body(req);
  if (typeof b.disabled !== 'boolean') fail(400, 'disabled must be true or false.');
  const updated = await setOfficerDisabled(officerId, b.disabled as boolean, officer);
  return json({ officer: await officerView(updated) });
});
