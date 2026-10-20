'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { Activity, Lock, Layers } from 'lucide-react';
import { useChainStatus } from '@/components/stablechain/useChainStatus';
import { STABLECHAIN } from '@/lib/stablechain';

/**
 * The network strip above every page. It shows the chain as the website's server last saw
 * it (online RPC, else a local node in development, else the reference values) and says
 * which. No figure here is simulated.
 */
export function SovereignTicker() {
  const { t, intl } = useI18n();
  const status = useChainStatus(10_000);
  const live = status?.live === true ? status : null;
  const sourceLabel = live ? (live.source === 'online' ? t('Live · online RPC') : t('Live · local node')) : t('Reference values');

  return (
    <div className="w-full bg-[#0E1B31] border-b border-[#C49A4E]/25 text-[11.5px] tabular-nums text-[#F4EEDF]/80 overflow-hidden relative z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-4">

        {/* Left: the chain, and where these figures come from */}
        <div className="flex items-center gap-3 shrink-0">
          <div className={`flex items-center gap-1.5 ${live ? 'text-emerald-300' : 'text-[#C49A4E]'}`}>
            <span className="relative flex h-2 w-2">
              {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${live ? 'bg-emerald-300' : 'bg-[#C49A4E]'}`} />
            </span>
            <span className="font-bold tracking-[0.1em] text-[10.5px] uppercase">{t("SOVEREIGN NETWORK PULSE")}</span>
          </div>
          <span className="hidden sm:inline text-white/20">|</span>
          <span className="hidden sm:inline text-[#F4EEDF]/60">
            {live ? (
              <>
                {t('Block height')}{' '}<span className="text-[#C49A4E] font-semibold">{live.height.toLocaleString(intl)}</span>
                {live.network !== 'mainnet' && <span className="text-[#F4EEDF]/45">{' · '}<span translate="no" data-i18n-skip="">{live.network}</span></span>}
              </>
            ) : (
              <span className="text-[#F4EEDF]/70">{t('Aletheia StableChain Mainnet')}</span>
            )}
            <span className="text-[#F4EEDF]/40">{' · '}{sourceLabel}</span>
          </span>
        </div>

        {/* Right: the network's facts */}
        <div className="flex items-center gap-5 text-[11px] overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 text-[#F4EEDF]/75">
            <Activity className="w-3 h-3 text-[#C49A4E]/80" />
            <span>{t('Slot time')}:{' '}<strong className="text-white">{STABLECHAIN.slotMs} ms</strong></span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[#F4EEDF]/75">
            <Lock className="w-3 h-3 text-[#C49A4E]/80" />
            <span>{t("Currency:")}{' '}<a href="https://rbaletheia.org" target="_blank" rel="noopener noreferrer" className="text-[#C49A4E] font-bold hover:underline">{t("AEY · Reserve Bank of Aletheia")}</a></span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[#F4EEDF]/75">
            <Layers className="w-3 h-3 text-[#C49A4E]/80" />
            <span>
              {live ? t('Epoch') : t('Protocol version')}:{' '}
              <strong className="text-white">{live ? live.epoch.toLocaleString(intl) : `v${STABLECHAIN.protocolVersion}`}</strong>
            </span>
          </div>

          <Link
            href="/stablechain"
            className="flex items-center gap-1 text-[#C49A4E] hover:text-[#E4C689] transition-colors underline underline-offset-2 decoration-[#C49A4E]/40"
          >
            <span>{t("Live Proofs")}</span>
            <span className="text-[9px]">→</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
