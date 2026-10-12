'use client';

import { Globe2 } from 'lucide-react';
import { AdminShell } from '@/components/layout/AdminShell';
import { ApplicationQueue } from '@/components/admin/ApplicationQueue';

export default function AdminEResidencyQueuePage() {
  return (
    <AdminShell>
      <ApplicationQueue
        type="e-residency"
        title="E-Residency Application Queue"
        subtitle="Digital E-Residency & Virtual Jurisdiction Act · Identity and KYC review"
        icon={Globe2}
        approveLabel="Grant E-Residency"
        related={{ href: '/admin/documents', label: 'Document Review' }}
      />
    </AdminShell>
  );
}
