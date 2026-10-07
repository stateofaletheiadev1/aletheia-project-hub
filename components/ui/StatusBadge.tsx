'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import { NationalStatus, STATUS_CONFIG } from '@/lib/status';

interface StatusBadgeProps {
  status: NationalStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'sm', showDot = true, className = '' }: StatusBadgeProps) {
  const { tx } = useI18n();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Vision'];

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 tracking-wide',
    md: 'text-xs px-2.5 py-1 tracking-wider',
    lg: 'text-sm px-3 py-1.5 tracking-wider',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-sm border uppercase font-sans whitespace-nowrap shrink-0 ${config.badgeClass} ${sizeClasses[size]} ${className}`}
      title={tx(config.description)}
    >
      {tx(showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: config.dotColor }}
          aria-hidden="true"
        />
      ))}
      <span className="whitespace-nowrap">{tx(status)}</span>
    </span>
  );
}
