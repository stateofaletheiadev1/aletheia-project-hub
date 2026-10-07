'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { useEffect } from 'react';
import { useRouter } from '@/lib/i18n/navigation';

export default function GeneralLoginPage() {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy text-parchment font-mono text-xs">{t("Redirecting to Sovereign Authentication Gateway...")}</div>
  );
}
