'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { LanguageLinks } from '@/components/i18n/LanguageSwitcher';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { usePathname } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import { NationalFlag, StateEnsign } from '@/components/brand/Flags';

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
      {/* Platform Status Legal Notice (Mandatory per §3.4) */}
      <div className="bg-navy-deep border-b border-gold/20 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
            <span className="font-semibold text-gold tracking-wide uppercase text-[11px]">{t("Platform Status Notice:")}</span>
            <span className="text-parchment/80">{t("The Sovereign Covenant State of Aletheia is a maritime republic in its founding phase. Features, services, and institutions are categorized strictly as")}<span className="text-gold font-medium">{' '}{t("Operational")}</span>, 
              <span className="text-gold font-medium">{' '}{t("Under Development")}</span>{t(", or")}<span className="text-gold font-medium">{' '}{t("Planned")}</span>.
            </span>
          </div>
          <Link
            href="/transparency"
            className="text-gold underline hover:text-gold-tint shrink-0 font-medium transition-colors"
          >{t("Review Status & Disclaimers →")}</Link>
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
                <span className="block text-xs text-gold tracking-[0.2em] uppercase font-medium">{t("Sovereign Covenant State")}</span>
              </div>
            </div>

            <p className="text-xs text-parchment/70 leading-relaxed max-w-sm">{t("A sovereign, European-oriented maritime republic founded upon immutable records, provable reserves, and the rule of covenant law.")}</p>

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

            <div className="pt-2 text-[11px] text-parchment/50">{t("Motto:")}{' '}<span className="text-gold font-serif italic">{t("Veritas in Foedere")}</span>{' '}{t("(Truth in Covenant)")}</div>
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
                <Link href="/government#assembly" className="hover:text-gold transition-colors">{t("Covenant Assembly (61 Seats)")}</Link>
              </li>
              <li>
                <Link href="/government#judiciary" className="hover:text-gold transition-colors">{t("The High Court of Aletheia")}</Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-gold transition-colors">{t("Official Gazette & Acts")}</Link>
              </li>
              <li>
                <Link href="/transparency" className="hover:text-gold transition-colors">{t("Public Ledger Audit")}</Link>
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
                <Link href="/citizenship/apply" className="hover:text-gold transition-colors">{t("Apply for Citizenship")}</Link>
              </li>
              <li>
                <Link href="/registry" className="hover:text-gold transition-colors">{t("National Registry & Revenue")}</Link>
              </li>
              <li>
                <Link href="/e-residency" className="hover:text-gold transition-colors">{t("E-Residency Programme")}</Link>
              </li>
              <li>
                <Link href="/passport" className="hover:text-gold transition-colors">{t("The ICAO eMRTD Passport")}</Link>
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
                <Link href="/stablechain" className="hover:text-gold transition-colors">{t("StableChain Distributed Rail")}</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Defense & Territory */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-eyebrow uppercase text-gold border-b border-parchment/10 pb-1.5">{t("Territory & Security")}</h4>
            <ul className="space-y-2 text-xs text-parchment/80">
              <li>
                <Link href="/development#antioch" className="hover:text-gold transition-colors">{t("Federal District Antioch")}</Link>
              </li>
              <li>
                <Link href="/development" className="hover:text-gold transition-colors">{t("The Four Founding States")}</Link>
              </li>
              <li>
                <Link href="/adss" className="hover:text-gold transition-colors">{t("ADSS Defence & Security")}</Link>
              </li>
              <li>
                <Link href="/adss/cybersecurity" className="hover:text-gold transition-colors">{t("Cybersecurity Department")}</Link>
              </li>
              <li>
                <Link href="/adss#police" className="hover:text-gold transition-colors">{t("Civilian Police Directorate")}</Link>
              </li>
              <li>
                <Link href="/admin/login" className="hover:text-gold transition-colors flex items-center gap-1 text-gold font-medium">
                  <span>{t("Officer Admin Clearance Access")}</span>
                </Link>
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
            <span>{t("Official Languages:")}</span>
            <LanguageLinks />
          </div>
        </div>
      </div>
    </footer>
  );
}
