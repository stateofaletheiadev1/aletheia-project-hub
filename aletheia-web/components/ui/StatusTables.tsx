'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MONTEVIDEO, NATIONAL_ASSETS, STATUS_REGISTER } from '@/lib/status';

/** The public status register (lib/status.ts) as a table. */
export function StatusRegisterTable() {
  const { t, tx } = useI18n();
  return (
    <div className="overflow-x-auto bg-white border border-navy/15 rounded-sm shadow-sm">
      <table className="w-full text-left text-sm border-collapse">
        <caption className="sr-only">{t('Status register')}</caption>
        <thead>
          <tr className="bg-parchment-light text-navy/70 uppercase text-[10px] tracking-wider border-b border-navy/10">
            <th scope="col" className="p-3 font-bold">{t('Asset')}</th>
            <th scope="col" className="p-3 font-bold">{t('Status')}</th>
            <th scope="col" className="p-3 font-bold">{t('Note')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/10">
          {STATUS_REGISTER.map((key) => (
            <tr key={key}>
              <th scope="row" className="p-3 font-semibold text-navy align-top">{tx(NATIONAL_ASSETS[key].label)}</th>
              <td className="p-3 align-top"><StatusBadge asset={key} size="sm" /></td>
              <td className="p-3 text-navy/65 text-xs leading-relaxed align-top">{tx(NATIONAL_ASSETS[key].note)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Aletheia measured against the four Montevideo criteria of statehood. */
export function MontevideoTable() {
  const { t, tx } = useI18n();
  return (
    <div className="overflow-x-auto bg-white border border-navy/15 rounded-sm shadow-sm">
      <table className="w-full text-left text-sm border-collapse">
        <caption className="sr-only">{t('The four Montevideo criteria')}</caption>
        <thead>
          <tr className="bg-parchment-light text-navy/70 uppercase text-[10px] tracking-wider border-b border-navy/10">
            <th scope="col" className="p-3 font-bold">{t('Criterion')}</th>
            <th scope="col" className="p-3 font-bold">{t('Status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/10">
          {MONTEVIDEO.map(({ criterion, asset }) => (
            <tr key={criterion}>
              <th scope="row" className="p-3 font-semibold text-navy align-top">{tx(criterion)}</th>
              <td className="p-3 align-top">
                <div className="flex flex-col items-start gap-1.5">
                  <StatusBadge asset={asset} size="sm" />
                  <span className="text-xs text-navy/65 leading-relaxed">{tx(NATIONAL_ASSETS[asset].note)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
