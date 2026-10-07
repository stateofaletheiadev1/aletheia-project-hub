'use client';

import { useEffect } from 'react';
import { useRouter } from '@/lib/i18n/navigation';

export default function OfficerLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0F1A] text-gold font-mono text-xs">
      Directing to Officer Clearance Login Gateway...
    </div>
  );
}
