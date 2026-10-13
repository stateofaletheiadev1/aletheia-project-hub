import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { applicantPii, applications, citizens } from '@/lib/server/registry';
import { companies } from '@/lib/server/companies';
import { documents } from '@/lib/server/documents';
import { accounts } from '@/lib/server/accounts';
import { recentAudit } from '@/lib/server/records';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const [citizenCount, eResidents, activeCompanies, pendingEres, pendingCit, pendingCompanies, pendingDocs, pendingApps, pendingFirms, recent] = await Promise.all([
    citizens().count({ status: 'Active' }),
    accounts().count({ status: 'e-resident' }),
    companies().count({ status: 'Active / Chartered' }),
    applications().count({ type: 'e-residency', status: 'Pending' }),
    applications().count({ type: 'citizenship', status: 'Pending' }),
    companies().count({ status: 'Pending Review' }),
    documents().count({ status: 'Pending Review' }),
    applications().find({ status: 'Pending' }, { sort: { submittedAt: -1 }, limit: 5 }),
    companies().find({ status: 'Pending Review' }, { sort: { submittedAt: -1 }, limit: 5 }),
    recentAudit({}, { limit: 6, maxDays: 30 }),
  ]);
  const queue = [
    ...(await Promise.all(pendingApps.documents.map(async (a) => {
      const p = await applicantPii(a);
      return { id: a._id, kind: 'application' as const, reference: a.reference, name: p.applicant, type: a.type === 'e-residency' ? 'E-Residency' : 'Citizenship Application', nationality: p.nationality, date: a.submittedAt };
    }))),
    ...pendingFirms.documents.map((c) => ({ id: c._id, kind: 'company' as const, reference: c.regNumber, name: c.name, type: `${c.structure} Incorporation`, nationality: '—', date: c.submittedAt })),
  ]
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 6);
  return json({
    stats: { citizens: citizenCount, eResidents, companies: activeCompanies, pending: pendingEres + pendingCit + pendingCompanies + pendingDocs },
    pending: { eResidency: pendingEres, citizenship: pendingCit, companies: pendingCompanies, documents: pendingDocs },
    queue,
    activity: recent.events.map((e) => ({ time: e.at, action: e.action, type: e.outcome === 'failure' ? 'warning' : 'success' })),
  });
});
