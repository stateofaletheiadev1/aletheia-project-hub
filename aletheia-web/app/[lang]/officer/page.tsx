'use client';

import { useEffect } from 'react';
import { useRouter } from '@/lib/i18n/navigation';
import { getOfficerSession } from '@/lib/auth';

export default function OfficerPortalIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getOfficerSession();
    if (session && session.id) {
      router.replace('/admin');
    } else {
      router.replace('/admin/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0F1A] text-gold font-mono text-xs">
      Connecting to Sovereign Administrative Console (ADSS)...
    </div>
  );
}
