'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GeneralLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy text-parchment font-mono text-xs">
      Redirecting to Sovereign Authentication Gateway...
    </div>
  );
}
