'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { Search, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface SearchItem {
  title: string;
  category: 'Constitution' | 'Government' | 'Service' | 'Security' | 'Economy';
  href: string;
  desc: string;
  status?: 'Operational' | 'Under Development' | 'Planned' | 'Proposed' | 'Vision';
}

const SEARCH_DATABASE: SearchItem[] = [
  // Constitution
  { title: 'Article 1: Founding Promises & Provable State', category: 'Constitution', href: '/constitution#art-1', desc: 'Truth in records, honest money, and lean constitutional government.' },
  { title: 'Article 8: Citizenship by Descent & Naturalisation', category: 'Constitution', href: '/constitution#art-8', desc: 'Eligibility, Covenant Oath, and rights of citizens.' },
  { title: 'Article 11: E-Residency & Digital Identity', category: 'Constitution', href: '/constitution#art-11', desc: 'Remote commercial rights, digital identity, zero physical residency.' },
  { title: 'Article 16: StableChain & Monetary Invariants', category: 'Constitution', href: '/constitution#art-16', desc: '500 ms slots, finality in about a second, 100% reserve invariants.' },
  { title: 'Article 46: ADSS & Unified Security Architecture', category: 'Constitution', href: '/constitution#art-46', desc: 'One force, civilian command, institutional distinction of police.' },
  { title: 'Article 53: Aletheian Cybersecurity Department', category: 'Constitution', href: '/constitution#art-53', desc: 'Mandatory national cyber defence and validator infrastructure resilience.' },
  
  // Government & Ministries
  { title: 'Ministry of Treasury & Finance', category: 'Government', href: '/treasury', desc: 'Covenant Endowment Fund, bond issuance, tax-free revenue model.' },
  { title: 'Ministry of Digital State & Registries', category: 'Government', href: '/technology', desc: 'State validators, identity verification, e-residency registry.' },
  { title: 'Ministry of Security & Civil Defence', category: 'Government', href: '/security', desc: 'Civilian oversight of ADSS and emergency disaster response.' },
  { title: 'The Covenant Assembly', category: 'Government', href: '/government#assembly', desc: '61 members elected by open-list PR every 4 years.' },
  { title: 'Council of the States', category: 'Government', href: '/government#council', desc: '15 members representing Antioch and the 4 states.' },
  { title: 'The High Court of Aletheia', category: 'Government', href: '/government#judiciary', desc: 'Supreme constitutional chamber and hybrid dispute arbitration.' },

  // Services
  { title: 'Apply for E-Residency', category: 'Service', href: '/e-residency', desc: '15-minute digital incorporation and borderless business access.', status: 'Under Development' },
  { title: 'ICAO Biometric Passport Specification', category: 'Service', href: '/passport', desc: 'Covenant Burgundy eMRTD booklet specification to Doc 9303.' },
  { title: 'Immigration & Residence Application', category: 'Service', href: '/immigration', desc: '5-year renewable residency permits and status tracking.', status: 'Planned' },
  { title: 'Public Transparency & Ledger Audit', category: 'Service', href: '/transparency', desc: 'Real-time Merkle balance sheet proofs and public receipts.', status: 'Operational' },

  // Security & ADSS
  { title: 'Aletheian Cybersecurity Department', category: 'Security', href: '/adss/cybersecurity', desc: 'Critical infrastructure protection, threat intel, vulnerability disclosure.', status: 'Operational' },
  { title: 'Civilian Police Directorate', category: 'Security', href: '/adss#police', desc: 'Community safety and lawful criminal investigation.', status: 'Planned' },
  { title: 'Immigration Officer Workbench', category: 'Security', href: '/admin/immigration', desc: 'Secure administrative case management for immigration officers.' },
  // Society, public services & information
  { title: 'Apply for Citizenship', category: 'Service', href: '/citizenship/apply', desc: 'Check eligibility for naturalisation or the Covenant Investor route.', status: 'Under Development' },
  { title: 'National Registry & Revenue', category: 'Economy', href: '/registry', desc: 'Registrations by programme and funds raised to build the Sovereign Covenant State.' },
  { title: 'Life in Aletheia', category: 'Service', href: '/society', desc: 'Languages, culture, civic calendar, and maritime heritage.' },
  { title: 'Health & Social Care', category: 'Service', href: '/healthcare', desc: 'Universal covenant healthcare and the National Health Registry.', status: 'Planned' },
  { title: 'Education & Research', category: 'Service', href: '/education', desc: 'Bilingual schools, the National University, scholarships.', status: 'Planned' },
  { title: 'Official Gazette', category: 'Government', href: '/news', desc: 'Decrees, appointments, and engineering bulletins.', status: 'Operational' },
  { title: 'Frequently Asked Questions', category: 'Service', href: '/faq', desc: 'Plain answers on membership, money, data, and status.' },
  { title: 'Privacy Notice', category: 'Service', href: '/privacy', desc: 'How personal data is protected — never written to the ledger.' },
];

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t, tx } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = SEARCH_DATABASE.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.desc.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open
          setQuery('');
          
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-navy-deep/70 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-parchment-canvas border border-gold/40 shadow-elevated rounded-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-navy/15 flex items-center px-4 bg-white">
          <Search className="w-5 h-5 text-gold shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              
            }}
            placeholder={t("Search the Constitution, 9 Ministries, Laws, or Services...")}
            className="w-full py-4 text-base bg-transparent text-navy placeholder:text-navy/40 focus:outline-none font-sans"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1.5 text-navy/50 hover:text-navy rounded-sm"
            aria-label={t("Close search")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-navy/5">
          {tx(filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-navy/60">{t("No official provisions or records found matching “")}{tx(query)}{t("”.")}</div>
          ) : (
            filtered.map((item) => (
              <Link
                key={item.title + item.href}
                href={item.href}
                // Console pages load in full, so the browser can move to the console's own address.
                onNavigate={item.href.startsWith('/admin') ? (e) => { e.preventDefault(); window.location.assign(item.href); } : undefined}
                onClick={onClose}
                className="group block p-3 rounded-sm hover:bg-parchment-light transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gold font-semibold px-1.5 py-0.5 bg-navy/5 border border-navy/10 rounded-sm">
                      {tx(item.category)}
                    </span>
                    <h4 className="text-sm font-semibold text-navy group-hover:text-gold transition-colors">
                      {tx(item.title)}
                    </h4>
                  </div>
                  {tx(item.status && <StatusBadge status={item.status} size="sm" />)}
                </div>
                <p className="text-xs text-navy/70 line-clamp-1 mt-1 font-normal">
                  {tx(item.desc)}
                </p>
              </Link>
            ))
          ))}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 bg-parchment-light border-t border-navy/10 flex items-center justify-between text-[11px] text-navy/60 font-mono">
          <span>{t("Navigate with mouse or Tab")}</span>
          <span>{t("ESC to close")}</span>
        </div>
      </div>
    </div>
  );
}
