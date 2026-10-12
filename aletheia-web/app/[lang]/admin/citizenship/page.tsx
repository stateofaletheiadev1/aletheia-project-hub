'use client';

import { UserCheck } from 'lucide-react';
import { AdminShell } from '@/components/layout/AdminShell';
import { ApplicationQueue } from '@/components/admin/ApplicationQueue';

export default function CitizenshipApprovalsPage() {
  return (
    <AdminShell>
      <ApplicationQueue
        type="citizenship"
        title="Citizenship Application Queue"
        subtitle="General Secretariat Ministerial Review · Articles 4 & 5 of the Covenant"
        icon={UserCheck}
        approveLabel="Grant Citizenship"
        related={{ href: '/admin/citizens', label: 'View Active Citizens' }}
      />
    </AdminShell>
  );
}
