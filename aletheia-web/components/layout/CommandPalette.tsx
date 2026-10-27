'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { Search, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { AssetKey, ManualStatus } from '@/lib/status';

interface SearchItem {
  title: string;
  category: 'Constitution' | 'Government' | 'Service' | 'Resilience' | 'Economy' | 'Founding';
  href: string;
  desc: string;
  asset?: AssetKey;
  status?: ManualStatus;
}

const SEARCH_DATABASE: SearchItem[] = [
  // The founding project
  { title: 'Status & Disclaimers', category: 'Founding', href: '/transparency', desc: 'The status register and what Aletheia is, and is not, today.', asset: 'platform' },
  { title: 'Register interest as a Founding Member', category: 'Founding', href: '/founding-members', desc: 'Free. Aletheia does not sell citizenship, residency, passports or currency.' },
  { title: 'Founding Team', category: 'Founding', href: '/about', desc: 'Who is building Aletheia, and how to reach them.' },
  { title: 'Roadmap', category: 'Founding', href: '/roadmap', desc: 'The path, phase by phase, to a pilot platform.' },
  { title: 'Founding Thesis', category: 'Founding', href: '/thesis', desc: 'Legal structure, governance, economics, host regions and diplomacy.' },
  { title: 'Financing the Build', category: 'Founding', href: '/development#financing', desc: 'How the platforms would be paid for, with the reserves kept apart.' },
  { title: 'The Seastead', category: 'Founding', href: '/development#seastead', desc: 'A territory at sea that Aletheia builds and owns.', asset: 'territory' },

  // Constitution
  { title: 'Article 1: Nature of the Sovereign Covenant State', category: 'Constitution', href: '/constitution#article-1', desc: 'A federal democratic republic and maritime nation, founded on truth and covenant.' },
  { title: 'Part IV: Citizenship and Dual Citizenship', category: 'Constitution', href: '/constitution#part-iv', desc: 'Citizenship by birth, descent and naturalisation; dual citizenship permitted.' },
  { title: 'Article 185: E-Residency', category: 'Constitution', href: '/constitution#article-185', desc: 'Proposed digital identity and commercial standing; not citizenship.' },
  { title: 'Part XII: The Reserve Bank and the Guilder', category: 'Constitution', href: '/constitution#part-xii', desc: 'The proposed currency, its single issuer and the rules for its issue.' },
  { title: 'Article 188: The Aletheian Defence & Security Service', category: 'Constitution', href: '/constitution#article-188', desc: 'Proposed civilian command and the separation of the police.' },
  { title: 'Article 196: Aletheian Cybersecurity Department', category: 'Constitution', href: '/constitution#article-196', desc: 'A proposed department to protect digital infrastructure.' },

  // Government & Ministries
  { title: 'Ministry of Treasury & Finance', category: 'Government', href: '/treasury', desc: 'The proposed Covenant Endowment and revenue model.' },
  { title: 'Ministry of Digital State & Registries', category: 'Government', href: '/technology', desc: 'StableChain Mainnet Beta, identity design and registries.' },
  { title: 'Ministry of Resilience & Civil Protection', category: 'Government', href: '/security', desc: 'Proposed civil oversight of resilience and emergency response.' },
  { title: 'The Covenant Assembly', category: 'Government', href: '/government#assembly', desc: 'A proposed 61-member parliament elected by open-list PR.', asset: 'institutions' },
  { title: 'Council of States', category: 'Government', href: '/government#council', desc: 'A proposed 15-member territorial chamber.', asset: 'institutions' },
  { title: 'The High Court of Aletheia', category: 'Government', href: '/government#judiciary', desc: 'A proposed constitutional court and dispute arbitration.', asset: 'institutions' },

  // Services
  { title: 'E-Residency', category: 'Service', href: '/e-residency', desc: 'Proposed digital identity and company formation. No applications are accepted.', asset: 'eResidency' },
  { title: 'Travel Document Design Concept', category: 'Service', href: '/design/travel-document', desc: 'A design concept. Not a travel document.', status: 'Proposed' },
  { title: 'Immigration & Residence', category: 'Service', href: '/immigration', desc: 'Proposed residence permits, within a future territory.', asset: 'residence' },

  // Resilience
  { title: 'Aletheian Cybersecurity Department', category: 'Resilience', href: '/adss/cybersecurity', desc: 'A planned department to protect digital infrastructure.', asset: 'cyber' },
  { title: 'Civilian Police Directorate', category: 'Resilience', href: '/adss#police', desc: 'Planned community safety and lawful investigation.', asset: 'police' },
  // Society, public services & information
  { title: 'The Founding Register', category: 'Economy', href: '/registry', desc: 'How the register is designed, and the public record.' },
  { title: 'Life in Aletheia', category: 'Service', href: '/society', desc: 'Languages, culture, civic calendar, and maritime heritage.' },
  { title: 'Health & Social Care', category: 'Service', href: '/healthcare', desc: 'The proposed covenant healthcare model.', status: 'Planned' },
  { title: 'Education & Research', category: 'Service', href: '/education', desc: 'Proposed schools, a National University and scholarships.', status: 'Planned' },
  { title: 'Gazette', category: 'Government', href: '/news', desc: 'Founding-phase records and design studies. No legal force.' },
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
            <div className="p-8 text-center text-sm text-navy/60">{t("No pages or records found matching “")}{tx(query)}{t("”.")}</div>
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
                  {item.asset ? <StatusBadge asset={item.asset} size="sm" /> : item.status ? <StatusBadge status={item.status} size="sm" /> : null}
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
