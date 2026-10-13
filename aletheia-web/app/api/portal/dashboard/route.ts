import { json, route } from '@/lib/server/http';
import { accountView, requireAccount } from '@/lib/server/accounts';
import { applications } from '@/lib/server/registry';
import { companies, companyView } from '@/lib/server/companies';
import { notifications, recentAudit } from '@/lib/server/records';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  const [apps, firms, events, unread] = await Promise.all([
    applications().find({ accountId: account._id }, { sort: { submittedAt: -1 }, limit: 20 }),
    companies().find({ accountId: account._id }, { sort: { submittedAt: -1 }, limit: 50 }),
    recentAudit({ subjectAccountId: account._id }, { limit: 8, maxDays: 90 }),
    notifications().count({ accountId: account._id, unread: true }),
  ]);
  return json({
    account: await accountView(account),
    applications: apps.documents.map((a) => ({ id: a._id, reference: a.reference, type: a.type, route: a.route, status: a.status, submittedAt: a.submittedAt, decidedAt: a.decidedAt, decisionNote: a.decisionNote })),
    companies: await Promise.all(firms.documents.map(companyView)),
    timeline: events.events.map((e) => ({ date: e.at, event: e.action, type: e.outcome === 'success' ? 'success' : 'pending' })),
    unreadNotifications: unread,
  });
});
