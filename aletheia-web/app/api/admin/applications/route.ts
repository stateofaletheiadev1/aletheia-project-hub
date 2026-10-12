import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { applications } from '@/lib/server/registry';
import { documents, kycStatus } from '@/lib/server/documents';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const type = req.nextUrl.searchParams.get('type');
  const filter: Record<string, unknown> = {};
  if (type === 'e-residency' || type === 'citizenship') filter.type = type;
  const { documents: list } = await applications().find(filter, { sort: { submittedAt: -1 }, limit: 200 });
  const rows = await Promise.all(
    list.map(async (a) => ({
      id: a._id,
      reference: a.reference,
      type: a.type,
      route: a.route,
      investOption: a.investOption,
      applicant: a.applicant,
      email: a.email,
      nationality: a.nationality,
      dob: a.dob,
      passportNumber: a.passportNumber,
      purpose: a.purpose,
      intendedEntity: a.intendedEntity,
      publicKey: a.publicKey,
      status: a.status,
      submittedAt: a.submittedAt,
      decidedAt: a.decidedAt,
      decisionNote: a.decisionNote,
      kycStatus: await kycStatus(a.accountId),
      documentCount: await documents().count({ accountId: a.accountId, direction: 'submitted' }),
    })),
  );
  return json({ applications: rows });
});
