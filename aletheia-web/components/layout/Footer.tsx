'use client';

import { RESERVE_BANK } from '@/lib/reserve-bank';
import { FoundingPhaseStatement } from '@/components/layout/FoundingPhaseNotice';

import { useI18n } from '@/components/i18n/I18nProvider';
import { LanguageLinks } from '@/components/i18n/LanguageSwitcher';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { usePathname } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import { NationalFlag, StateEnsign } from '@/components/brand/Flags';

import { STABLECHAIN } from '@/lib/stablechain';
export function Footer() {
  const { t, tx } = useI18n();
  const pathname = usePathname();

  // Hide public footer ONLY when inside logged-in Portal or Officer Admin environments (NOT on login pages)
  const isLoginPage = pathname === '/portal/login' || pathname === '/admin/login' || pathname === '/officer/login' || pathname === '/login';
  const isPortalOrAdmin = !isLoginPage && (pathname?.startsWith('/portal') || pathname?.startsWith('/admin') || pathname?.startsWith('/officer'));
  if (isPortalOrAdmin) {
    return null;
  }

  return (
    <footer className="bg-navy text-parchment border-t border-gold/40 mt-auto">
      {/* Founding-phase statement: permanent, on every public page */}
      <div className="bg-navy-deep border-b border-gold/20 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-start gap-3 text-xs">
          <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-gold tracking-wider uppercase text-[11px] shrink-0 pt-px">
            <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
            {t("Status")}
          </span>
          <p className="text-parchment/80 leading-relaxed">
            <FoundingPhaseStatement linkClassName="text-gold hover:text-gold-tint" />
          </p>
        </div>
      </div>

      {/* Main Footer Sitemap & Directory */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Identity & Seal Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/coat_of_arms_transparent.png"
                alt={t("Coat of Arms of Aletheia")}
                width={48}
                height={56}
                className="object-contain"
              />
              <div>
                <span className="block font-bold text-lg tracking-[0.14em] uppercase text-parchment font-sans">{t("ALETHEIA")}</span>
                <span className="block text-xs text-gold tracking-[0.14em] uppercase font-semibold">{t("Sovereign Covenant State")}</span>
              </div>
            </div>

            <p className="text-xs text-parchment/70 leading-relaxed max-w-sm">{t("A founding-phase project to build a European-oriented maritime nation at sea: founded upon open records, honest money, and the rule of covenant law.")}</p>

            <div className="pt-2 flex items-center gap-4">
              <div>
                <span className="block text-[10px] tracking-wider uppercase text-gold/70 mb-1">{t("National Flag")}</span>
                <NationalFlag width={54} height={36} />
              </div>
              <div>
                <span className="block text-[10px] tracking-wider uppercase text-gold/70 mb-1">{t("State & Maritime Ensign")}</span>
                <StateEnsign width={54} height={36} />
              </div>
            </div>

            <div className="pt-2 text-[11px] text-parchment/50">{t("Motto:")}{' '}<span className="text-gold italic">{t("Veritas in Foedere")}</span>{' '}{t("(Truth in Covenant)")}</div>
          </div>

          {/* Column 1: Government & Law */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-eyebrow uppercase text-gold border-b border-parchment/10 pb-1.5">{t("Government & Law")}</h4>
            <ul className="space-y-2 text-xs text-parchment/80">
              <li>
                <Link href="/constitution" className="hover:text-gold transition-colors">{t("The Covenant (Constitution)")}</Link>
              </li>
              <li>
                <Link href="/government" className="hover:text-gold transition-colors">{t("The Nine Ministries")}</Link>
              </li>
              <li>
                <Link href="/government#assembly" className="hover:text-gold transition-colors">{t("Covenant Assembly (proposed)")}</Link>
              </li>
              <li>
                <Link href="/government#judiciary" className="hover:text-gold transition-colors">{t("The High Court of Aletheia")}</Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-gold transition-colors">{t("Gazette & Founding Documents")}</Link>
              </li>
              <li>
                <Link href="/transparency" className="hover:text-gold transition-colors">{t("Status & Disclaimers")}</Link>
              </li>
              <li>
                <a href="https://www.aletheiagov.org" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">{t("Government Website (aletheiagov.org)")}</a>
              </li>
              <li>
                <a href={RESERVE_BANK.url} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">{t("Reserve Bank of Aletheia")}</a>
              </li>
            </ul>
          </div>

          {/* Column 2: Civic & Economy */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-eyebrow uppercase text-gold border-b border-parchment/10 pb-1.5">{t("Civic & Economy")}</h4>
            <ul className="space-y-2 text-xs text-parchment/80">
              <li>
                <Link href="/citizenship" className="hover:text-gold transition-colors">{t("Citizenship & Covenant Oath")}</Link>
              </li>
              <li>
                <Link href="/founding-members" className="hover:text-gold transition-colors">{t("Register interest as a Founding Member")}</Link>
              </li>
              <li>
                <Link href="/registry" className="hover:text-gold transition-colors">{t("The Founding Register")}</Link>
              </li>
              <li>
                <Link href="/e-residency" className="hover:text-gold transition-colors">{t("E-Residency (proposed)")}</Link>
              </li>
              <li>
                <Link href="/design/travel-document" className="hover:text-gold transition-colors">{t("Travel Document Design")}</Link>
              </li>
              <li>
                <Link href="/society" className="hover:text-gold transition-colors">{t("Life in Aletheia")}</Link>
              </li>
              <li>
                <Link href="/healthcare" className="hover:text-gold transition-colors">{t("Health & Social Care")}</Link>
              </li>
              <li>
                <Link href="/education" className="hover:text-gold transition-colors">{t("Education & Research")}</Link>
              </li>
              <li>
                <Link href="/treasury" className="hover:text-gold transition-colors">{t("Treasury & Endowment Fund")}</Link>
              </li>
              <li>
                <Link href="/aey" className="hover:text-gold transition-colors">{t("The Aletheian Guilder (AEY)")}</Link>
              </li>
              <li>
                <Link href="/stablechain" className="hover:text-gold transition-colors">{t("StableChain (testnet)")}</Link>
              </li>
              {STABLECHAIN.explorerLive && (
                <li>
                  <a href={STABLECHAIN.explorer} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">{t("StableChain Explorer")}</a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Defense & Territory */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-eyebrow uppercase text-gold border-b border-parchment/10 pb-1.5">{t("The Founding Project")}</h4>
            <ul className="space-y-2 text-xs text-parchment/80">
              <li>
                <Link href="/about" className="hover:text-gold transition-colors">{t("Founding Team")}</Link>
              </li>
              <li>
                <Link href="/roadmap" className="hover:text-gold transition-colors">{t("Roadmap")}</Link>
              </li>
              <li>
                <Link href="/thesis" className="hover:text-gold transition-colors">{t("Founding Thesis")}</Link>
              </li>
              <li>
                <Link href="/development" className="hover:text-gold transition-colors">{t("The Seastead")}</Link>
              </li>
              <li>
                <Link href="/adss" className="hover:text-gold transition-colors">{t("Resilience & Civil Protection")}</Link>
              </li>
              <li>
                <Link href="/adss/cybersecurity" className="hover:text-gold transition-colors">{t("Cybersecurity Department")}</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Sub-footer Copyright & Languages */}
        <div className="mt-14 pt-8 border-t border-parchment/10 flex flex-col xl:flex-row xl:flex-wrap items-center justify-between gap-x-8 gap-y-4 text-xs text-parchment/60 text-center xl:text-left">
          <div className="flex items-center gap-2">
            <StarOfTruth size={16} />
            <span>
              © {new Date().getFullYear()}{' '}{t("The Sovereign Covenant State of Aletheia. All rights reserved.")}</span>
          </div>

          <nav aria-label={t("Legal")} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
            {[
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms of Use' },
              { href: '/accessibility', label: 'Accessibility' },
              { href: '/faq', label: 'FAQ' },
              { href: '/contact', label: 'Contact' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-gold transition-colors">
                {tx(l.label)}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span>{t("Languages:")}</span>
            <LanguageLinks />
          </div>
        </div>
      </div>
    </footer>
  );
}
