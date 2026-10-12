import { body, json, oneOf, route, str } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { openRescission, rescissions } from '@/lib/server/registry';

const BASES = ['Voluntary Renunciation', 'Fraudulent Acquisition', 'Covenant Treason / Sanction', 'Dual Allegiance Conflict'] as const;
const STAGES = ['Hearing Scheduled', 'Evidence Review', 'Judicial Finality'] as const;

export const GET = route(async (req) => {
  await requireOfficer(req);
  const { documents } = await rescissions().find({}, { sort: { initiatedDate: -1 }, limit: 500 });
  return json({
    cases: documents.map((r) => ({ id: r._id, reference: r.reference, citizenName: r.citizenName, nationalId: r.nationalId, basis: r.basis, stage: r.stage, dossierRef: r.dossierRef, initiatedDate: r.initiatedDate, status: r.status })),
  });
});

export const POST = route(async (req) => {
  const { officer } = await requireOfficer(req);
  const b = await body(req);
  const r = await openRescission(
    { nationalId: str(b, 'nationalId', { max: 40, label: 'National ID' }), basis: oneOf(b, 'basis', BASES), stage: oneOf(b, 'stage', STAGES), dossierRef: str(b, 'dossierRef', { max: 60, label: 'Dossier reference' }) },
    officer,
  );
  return json({ case: { id: r._id, reference: r.reference } }, 201);
});
