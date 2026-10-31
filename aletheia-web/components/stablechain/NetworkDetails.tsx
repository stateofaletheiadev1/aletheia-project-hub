'use client';

import { ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { CopyValue } from '@/components/stablechain/CopyValue';
import { useChainStatus } from '@/components/stablechain/useChainStatus';
import { SourceBadge } from '@/components/stablechain/LiveChain';
import { EXAMPLE, STABLECHAIN } from '@/lib/stablechain';

/**
 * The network's public details, as a wallet, exchange or auditor needs them: endpoints,
 * chain identity, native assets and how identifiers are written. Values come from
 * lib/stablechain.ts; the chain ID is the one genesis assigned (7770 for Mainnet Beta).
 */
export function NetworkDetails() {
  const { t } = useI18n();
  const status = useChainStatus();
  // A local node is a development chain: its network and chain ID are shown as such.
  const live = status?.live === true ? status : null;
  const chainId = live ? String(live.chainId) : STABLECHAIN.chainId !== null ? String(STABLECHAIN.chainId) : null;

  const row = 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-parchment/10 last:border-b-0';
  const label = 'text-gold text-xs font-bold tracking-wide uppercase shrink-0 sm:w-56';
  const value = 'text-parchment/85 text-sm min-w-0 sm:text-right';

  return (
    <div className="space-y-6">
      <div className="bg-navy-deep p-5 rounded-sm border border-gold/20">
        <h4 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold/80 mb-2">{t('Endpoints')}</h4>
        <div className={row}>
          <span className={label}>{t('Public RPC')}</span>
          <span className={value}><CopyValue value={STABLECHAIN.rpc} /></span>
        </div>
        <div className={row}>
          <span className={label}>{t('REST interface')}</span>
          <span className={value}><CopyValue value={STABLECHAIN.rest} /></span>
        </div>
        <div className={row}>
          <span className={label}>{t('JSON-RPC 2.0 interface')}</span>
          <span className={value}><CopyValue value={STABLECHAIN.jsonRpc} /></span>
        </div>
        <div className={row}>
          <span className={label}>{t('Block explorer')}</span>
          <span className={value}>
            {STABLECHAIN.explorerLive ? (
              <a
                href={STABLECHAIN.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-gold hover:text-gold-tint break-all"
                translate="no" data-i18n-skip=""
              >
                {STABLECHAIN.explorer}
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </a>
            ) : (
              t('Published when the explorer opens to the public')
            )}
          </span>
        </div>
      </div>

      <div className="bg-navy-deep p-5 rounded-sm border border-gold/20">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h4 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold/80">{t('Network identity')}</h4>
          <SourceBadge status={status} />
        </div>
        <div className={row}>
          <span className={label}>{t('Network')}</span>
          <span className={value}>{live && live.network !== 'mainnet' ? (<><span translate="no" data-i18n-skip="">{live.network}</span>{` · ${t('local node')}`}</>) : t('AletheiaChain Mainnet Beta · chain 7770')}</span>
        </div>
        <div className={row}>
          <span className={label}>{t('Chain ID')}</span>
          <span className={value}>
            {chainId !== null ? <CopyValue value={chainId} /> : t('Assigned at the mainnet genesis ceremony')}
          </span>
        </div>
        <div className={row}>
          <span className={label}>{t('Protocol version')}</span>
          <span className={`${value} font-mono`}>{live ? live.protocolVersion : STABLECHAIN.protocolVersion}</span>
        </div>
        <div className={row}>
          <span className={label}>{t('Slot time')}</span>
          <span className={`${value} font-mono`}>{STABLECHAIN.slotMs} ms</span>
        </div>
        <div className={row}>
          <span className={label}>{t('Finality')}</span>
          <span className={value}>{t('About 1 s: 2-chain BFT, final two slots after proposal')}</span>
        </div>
        <div className={row}>
          <span className={label}>{t('Virtual machine')}</span>
          <span className={value}>{t('Native Arno contracts; not an EVM chain')}</span>
        </div>
      </div>

      <div className="bg-navy-deep p-5 rounded-sm border border-gold/20">
        <h4 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold/80 mb-2">{t('Native assets')}</h4>
        <div className={row}>
          <span className={label}>AEY</span>
          <span className={value}>{t('Aletheian Guilder · 18 decimals · proposed; not issued to the public')}</span>
        </div>
        <div className={row}>
          <span className={label}>ALnT</span>
          <span className={value}>{t('Aletheia Talent · 3 decimals · network utility asset; not offered or sold')}</span>
        </div>
        <div className={row}>
          <span className={label}>{t('Transaction fee')}</span>
          <span className={value}>{t('Execution units × the posted EU price; a transfer uses 2,000 EU')}</span>
        </div>
      </div>

      <div className="bg-navy-deep p-5 rounded-sm border border-gold/20">
        <h4 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold/80 mb-2">{t('Identifier formats')}</h4>
        <div className={row}>
          <span className={label}>{t('Account address')}</span>
          <span className={value}><CopyValue value={EXAMPLE.address} className="text-xs" /></span>
        </div>
        <div className={row}>
          <span className={label}>{t('Transaction ID')}</span>
          <span className={value}><CopyValue value={EXAMPLE.tx[0]} className="text-xs" /></span>
        </div>
        <div className={row}>
          <span className={label}>{t('Block ID')}</span>
          <span className={value}><CopyValue value={EXAMPLE.block[0]} className="text-xs" /></span>
        </div>
        <p className="pt-3 text-xs text-parchment/55 leading-relaxed">
          {t('Examples shown with valid checksums. Hashes and state roots are 64 lowercase hexadecimal characters. Aletheia never uses the 0x prefix: wallets and the RPC refuse it.')}
        </p>
      </div>
    </div>
  );
}
