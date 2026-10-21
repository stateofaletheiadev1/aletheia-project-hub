'use client';

import { ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useChainStatus } from '@/components/stablechain/useChainStatus';
import { STABLECHAIN, explorerUrl, shortId, type ChainStatus } from '@/lib/stablechain';

/** Which source the figures come from, in one short line. */
export function SourceBadge({ status }: { status: ChainStatus | null }) {
  const { t } = useI18n();
  if (status === null) return null;
  const live = status.live;
  const label = !live ? t('Reference values') : status.source === 'online' ? t('Live · online RPC') : t('Live · local node');
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-[0.12em] uppercase border ${
        live ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-gold border-gold/40 bg-navy-deep/60'
      }`}
      title={
        !live
          ? t('Neither the online RPC nor a local node answered; these are the network’s reference values.')
          : status.source === 'online'
            ? t('Live figures from the online RPC')
            : t('Live figures from a node on this machine')
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-300 animate-pulse' : 'bg-gold'}`} />
      {label}
    </span>
  );
}

/**
 * The hero card. Live figures when the online RPC or a local node answers; otherwise the
 * network's reference values, labelled. No figure is ever simulated.
 */
export function LiveChainCard() {
  const { t, intl } = useI18n();
  const status = useChainStatus();
  const num = (n: number) => n.toLocaleString(intl);

  if (status === null) {
    return <div className="relative z-10 text-center py-6 text-xs text-parchment/50 font-mono">{t('Contacting the StableChain RPC…')}</div>;
  }

  if (!status.live) {
    return (
      <div className="relative z-10 space-y-5">
        <div className="text-center space-y-2">
          <SourceBadge status={status} />
          <div className="text-2xl font-bold text-parchment">{t('Aletheia StableChain Mainnet')}</div>
          <p className="text-xs text-parchment/60 leading-relaxed max-w-xs mx-auto">
            {t('Live block figures appear here when the online RPC or a local node answers.')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('Slot time'), value: `${STABLECHAIN.slotMs} ms` },
            { label: t('Protocol'), value: `v${STABLECHAIN.protocolVersion}` },
            { label: t('Native assets'), value: 'AEY · ALnT' },
            { label: t('Transfer cost'), value: `${(2000).toLocaleString(intl)} EU` },
          ].map(({ label, value }) => (
            <div key={label} className="stat-tile p-3 rounded-sm text-center space-y-1">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{label}</span>
              <span className="text-sm font-bold text-parchment font-mono" translate="no" data-i18n-skip="">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] font-mono text-gold/80 break-all" translate="no" data-i18n-skip="">{STABLECHAIN.rpc}</p>
      </div>
    );
  }

  // A local node is a development chain: its blocks are not on the public explorer.
  const onExplorer = status.source === 'online';
  return (
    <div className="relative z-10 space-y-5">
      <div className="text-center space-y-1">
        <SourceBadge status={status} />
        <p className="pt-2 text-[10px] font-bold tracking-[0.22em] uppercase text-gold/80">{t('Latest finalized block')}</p>
        {onExplorer && STABLECHAIN.explorerLive ? (
          <a href={explorerUrl.block(status.height)} target="_blank" rel="noopener noreferrer" className="metric-display block hover:text-gold-tint">
            #{num(status.height)}
          </a>
        ) : (
          <div className="metric-display">#{num(status.height)}</div>
        )}
        <p className="text-xs text-parchment/50 font-mono" title={status.blockId} translate="no" data-i18n-skip="">
          {shortId(status.blockId, 12, 6)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('Network'), value: status.network },
          { label: t('Epoch'), value: num(status.epoch) },
          { label: t('Slot time'), value: `${STABLECHAIN.slotMs} ms` },
          { label: t('Protocol'), value: `v${status.protocolVersion}` },
        ].map(({ label, value }) => (
          <div key={label} className="stat-tile p-3 rounded-sm text-center space-y-1">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{label}</span>
            <span className="text-sm font-bold text-parchment font-mono" translate="no" data-i18n-skip="">{value}</span>
          </div>
        ))}
      </div>
      {onExplorer && STABLECHAIN.explorerLive && (
        <a
          href={STABLECHAIN.explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-tint"
        >
          {t('Open the block explorer')} <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

/** The four-figure strip under the hero: the live height when a node answers, else the reference values. */
export function LiveChainStrip() {
  const { t, intl } = useI18n();
  const status = useChainStatus();
  const live = status?.live === true ? status : null;
  const items = [
    live
      ? {
          value: `#${live.height.toLocaleString(intl)}`,
          label: t('Block height'),
          sub: live.source === 'online' ? t('Live · online RPC') : t('Live · local node'),
        }
      : { value: `v${STABLECHAIN.protocolVersion}`, label: t('Protocol version'), sub: t('Reference values') },
    { value: `${STABLECHAIN.slotMs} ms`, label: t('Slot time'), sub: t('Final two slots later') },
    { value: 'AEY · ALnT', label: t('Native assets'), sub: t('Proposed currency · testnet utility asset') },
    { value: `${(2000).toLocaleString(intl)} EU`, label: t('Transfer cost'), sub: t('Execution units × EU price') },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-gold/15 gap-y-2">
      {items.map(({ value, label, sub }) => (
        <div key={label} className="px-6 py-4 text-center first:pl-0 last:pr-0 space-y-0.5">
          <div className="text-2xl font-bold font-mono text-gold tracking-tight">{value}</div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-parchment/80">{label}</div>
          <div className="text-[10px] text-parchment/40 font-mono">{sub}</div>
        </div>
      ))}
    </div>
  );
}
