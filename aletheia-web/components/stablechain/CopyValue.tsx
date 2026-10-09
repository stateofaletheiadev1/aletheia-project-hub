'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';

/** A value set in mono with a copy button; the copied text is always the exact value. */
export function CopyValue({ value, className = '' }: { value: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <span className="font-mono break-all" translate="no" data-i18n-skip="">{value}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 p-1 rounded-sm text-gold/70 hover:text-gold hover:bg-white/5 transition-colors"
        aria-label={copied ? t('Copied') : t('Copy')}
        title={copied ? t('Copied') : t('Copy')}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}
