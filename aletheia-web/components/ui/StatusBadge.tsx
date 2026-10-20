'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import { type AssetKey, type ManualStatus, type NationalStatus, STATUS_CONFIG, STATUS_ORDER, assetStatus } from '@/lib/status';

type StatusSource =
  /** A national asset: its status comes from the status register in lib/status.ts. */
  | { asset: AssetKey; status?: never; legend?: never }
  /** Any other item. 'Operational' is not accepted here. */
  | { status: ManualStatus; asset?: never; legend?: never }
  /** Explaining the taxonomy itself (legends, the design system). */
  | { legend: NationalStatus; asset?: never; status?: never };

type StatusBadgeProps = StatusSource & {
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
};

export function StatusBadge({ size = 'sm', showDot = true, className = '', ...source }: StatusBadgeProps) {
  const { tx } = useI18n();
  const status: NationalStatus = source.asset ? assetStatus(source.asset) : (source.status ?? source.legend ?? 'Vision');
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
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: config.dotColor }}
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap">{tx(status)}</span>
    </span>
  );
}

/** All five statuses side by side, to explain the taxonomy. */
export function StatusLegend({ size = 'sm', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {STATUS_ORDER.map((s) => (
        <StatusBadge key={s} legend={s} size={size} />
      ))}
    </div>
  );
}
