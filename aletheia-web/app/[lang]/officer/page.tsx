'use client';

import { useEffect } from 'react';
import { useRouter } from '@/lib/i18n/navigation';

// The console checks the session itself and sends anyone not signed in to /admin/login.
export default function OfficerPortalIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0F1A] text-gold font-mono text-xs">
      Connecting to Sovereign Administrative Console (ADSS)...
    </div>
  );
}
