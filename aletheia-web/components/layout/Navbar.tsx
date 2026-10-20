'use client';

import { ConsoleLink } from '@/components/layout/ConsoleLink';
import { useI18n } from '@/components/i18n/I18nProvider';
import { LanguageLinks, LanguageMenu } from '@/components/i18n/LanguageSwitcher';
import React, { useState, useEffect, useRef } from 'react';
import Link from '@/components/i18n/Link';
import { usePathname } from '@/lib/i18n/navigation';
import Image from 'next/image';
import { MAIN_NAVIGATION } from '@/lib/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { SovereignTicker } from '@/components/ui/SovereignTicker';
import {
  Search,
  Menu,
  X,
  ChevronDown,
  Shield,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

// ── Shortened nav labels so nothing wraps in the bar ──────────────────────────
const NAV_LABELS: Record<string, string> = {
  'Aletheia':       'Aletheia',
  'Government':     'Government',
  'Citizenship':    'Citizenship',
  'E-Residency':    'E-Residency',
  'Immigration':    'Immigration',
  'Development':    'Development',
  'Economy':        'Economy',
  'Security & ADSS':'Security',
};

const EDITORIAL: Record<string, { title: string; desc: string; href: string; tag: string }> = {
  Aletheia: {
    title: 'National Blueprint 2026.3',
    desc: 'Complete architectural specification of the Sovereign Covenant State.',
    href: '/aletheia',
    tag: 'FOUNDATIONAL DECREE',
  },
  Government: {
    title: '67 Constitutional Articles',
    desc: 'Inspect the legal charter binding government, states, and citizens.',
    href: '/constitution',
    tag: 'THE COVENANT',
  },
  Development: {
    title: 'Antioch Concentric Masterplan',
    desc: 'Six radial avenues and hexagonal civic district designed for ledger finality.',
    href: '/development',
    tag: 'URBAN ARCHITECTURE',
  },
  Economy: {
    title: 'The Aletheian Guilder (AEY)',
    desc: 'The national currency, issued by the Reserve Bank of Aletheia.',
    href: '/aey',
    tag: 'MONETARY FRAMEWORK',
  },
  'Security & ADSS': {
    title: 'Cybersecurity Department',
    desc: 'Mandatory standalone agency protecting critical infrastructure & validators.',
    href: '/adss/cybersecurity',
    tag: 'NATIONAL RESILIENCE',
  },
};

export function Navbar() {
  const { t, tx } = useI18n();
  const pathname = usePathname();
  const [activeMenu, setActiveMenu]   = useState<string | null>(null);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [scrolled,   setScrolled]     = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* scroll shadow */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* route changes → close everything (state adjusted during render, not in an effect) */
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setActiveMenu(null); setMobileOpen(false);
    setSearchOpen(false);
  }

  /* keyboard */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setActiveMenu(null); setMobileOpen(false); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const enter = (label: string) => {
    if (closeRef.current) clearTimeout(closeRef.current);
    setActiveMenu(label);
  };
  const leave = () => {
    closeRef.current = setTimeout(() => setActiveMenu(null), 140);
  };

  // Hide public navigation ONLY when inside logged-in Portal or Officer Admin environments (NOT on login pages)
  const isLoginPage = pathname === '/portal/login' || pathname === '/admin/login' || pathname === '/officer/login' || pathname === '/login';
  const isPortalOrAdmin = !isLoginPage && (pathname?.startsWith('/portal') || pathname?.startsWith('/admin') || pathname?.startsWith('/officer'));
  if (isPortalOrAdmin) {
    return null;
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          SOVEREIGN RIBBON  — 28 px, dark, desktop-only
      ════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block w-full bg-[#0E1B31] border-b border-[#C49A4E]/20">
        <div className="max-w-screen-xl mx-auto px-6 h-7 flex items-center justify-between">

          {/* left: branding sentence */}
          <div className="flex items-center gap-3 text-[11px] leading-none">
            <span className="flex items-center gap-1.5 font-bold tracking-[0.12em] uppercase text-[#C49A4E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C49A4E]" />{t("Digital Platform")}</span>
            <span className="text-white/20">|</span>
            <span className="text-white/60">{t("The Sovereign Covenant State of Aletheia")}</span>
            <span className="text-white/20">|</span>
            <span className="italic text-[#C49A4E]/80">{t("Veritas in Foedere")}</span>
          </div>

          {/* right: utilities */}
          <div className="flex items-center gap-4 text-[11px] text-white/60 leading-none">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={t("Search the platform (Ctrl or Command + K)")}
              className="flex items-center gap-1 hover:text-[#C49A4E] transition-colors"
            >
              <Search className="w-2.5 h-2.5" /> ⌘K
            </button>
            <span className="text-white/15">|</span>
            <Link href="/transparency" className="hover:text-[#C49A4E] transition-colors">{t("Public Ledger Audit")}</Link>
            <span className="text-white/15">|</span>

            {/* language */}
            <LanguageMenu />

            <span className="text-white/15">|</span>
            <ConsoleLink
              href="/admin/login"
              className="flex items-center gap-1 text-[#C49A4E]/70 hover:text-[#C49A4E] transition-colors font-semibold"
            >
              <Shield className="w-2.5 h-2.5" />{' '}{t("Officer Portal")}</ConsoleLink>
          </div>
        </div>
      </div>

      {/* ── REAL-TIME CRYPTOGRAPHIC INVARIANT PULSE ── */}
      <SovereignTicker />

      {/* ════════════════════════════════════════════════════════════
          MAIN NAV BAR  — 64 px fixed height
      ════════════════════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-[0_1px_0_0_rgba(21,41,74,0.10),0_6px_32px_-8px_rgba(21,41,74,0.09)]'
            : 'bg-[#FAF7F0] border-b border-[#15294A]/[0.07]'
        }`}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between" style={{ height: 64 }}>

            {/* ── LOGO ───────────────────────────────────────────── */}
            <Link
              href="/"
              aria-label={t("Aletheia Home")}
              className="flex items-center gap-2.5 shrink-0 group"
            >
              <Image
                src="/coat_of_arms_transparent.png"
                alt={t("Arms of Aletheia")}
                width={36}
                height={42}
                className="object-contain drop-shadow-sm"
                priority
              />
              <div className="flex flex-col leading-none">
                <span className="text-[16px] font-extrabold tracking-[0.16em] uppercase text-[#15294A] whitespace-nowrap">{t("ALETHEIA")}</span>
                <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#A87D34] whitespace-nowrap mt-1">{t("Sovereign Covenant State")}</span>
              </div>
            </Link>

            {/* ── DESKTOP NAV ────────────────────────────────────── */}
            <nav className="hidden xl:flex items-center" aria-label={t("Primary")}>
              {MAIN_NAVIGATION.map(item => {
                const hasDropdown = !!(item.children?.length);
                const label       = NAV_LABELS[item.label] ?? item.label;
                const isActive    =
                  pathname === item.href ||
                  (item.children?.some(c =>
                    c.items.some(i => pathname.startsWith(i.href))
                  ) ?? false);

                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => hasDropdown && enter(item.label)}
                    onMouseLeave={leave}
                    onFocus={() => hasDropdown && enter(item.label)}
                    onBlur={(e) => {
                      // Keep the menu open while focus moves within it (keyboard navigation).
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave();
                    }}
                  >
                    <Link
                      href={item.href}
                      aria-haspopup={hasDropdown ? 'true' : undefined}
                      aria-expanded={hasDropdown ? activeMenu === item.label : undefined}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      className={`relative flex items-center gap-0.5 px-1.5 2xl:px-3 py-2 text-[13px] 2xl:text-[14px] font-semibold whitespace-nowrap rounded-[3px] transition-colors ${
                        isActive
                          ? 'text-[#15294A]'
                          : 'text-[#15294A]/70 hover:text-[#15294A] hover:bg-[#15294A]/[0.04]'
                      }`}
                    >
                      {/* active indicator */}
                      {tx(isActive && (
                        <span className="absolute bottom-0 left-1.5 right-1.5 2xl:left-3 2xl:right-3 h-[2px] bg-[#C49A4E]" />
                      ))}
                      {tx(label)}
                      {tx(hasDropdown && (
                        <ChevronDown
                          className={`ml-0.5 w-3 h-3 text-[#15294A]/30 transition-transform duration-150 ${
                            activeMenu === item.label ? 'rotate-180' : ''
                          }`}
                        />
                      ))}
                    </Link>

                    {/* ── MEGA-MENU ─────────────────────────────── */}
                    {tx(hasDropdown && activeMenu === item.label && (
                      <div
                        className="animate-fade-in absolute left-1/2 -translate-x-1/2 top-[calc(100%+2px)] w-[680px] bg-white border border-[#15294A]/[0.08] shadow-[0_18px_40px_-16px_rgba(21,41,74,0.28)] border-t-2 border-t-[#C49A4E] rounded-b-[4px] overflow-hidden z-50"
                        onMouseEnter={() => enter(item.label)}
                        onMouseLeave={leave}
                      >
                        <div className="grid grid-cols-12 divide-x divide-[#15294A]/[0.07]">

                          {/* link columns */}
                          <div className="col-span-8 p-5 grid grid-cols-2 gap-x-5 gap-y-0.5">
                            {item.children?.map(group => (
                              <div key={group.group}>
                                <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#A87D34] mb-2.5 mt-1">
                                  {tx(group.group)}
                                </p>
                                {group.items.map(sub => (
                                  <Link
                                    key={sub.href}
                                    href={sub.href}
                                    className="group/l flex items-start gap-2 px-2 py-1.5 rounded-[3px] hover:bg-[#F6F3EC] transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[13.5px] font-semibold text-[#15294A] group-hover/l:underline underline-offset-[3px] decoration-[#C49A4E] decoration-2 leading-tight">
                                          {tx(sub.title)}
                                        </span>
                                        {tx(sub.status && (
                                          <StatusBadge status={sub.status} size="sm" />
                                        ))}
                                      </div>
                                      <p className="text-[12px] text-[#15294A]/60 mt-0.5 line-clamp-1 leading-snug">
                                        {tx(sub.desc)}
                                      </p>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            ))}
                          </div>

                          {/* editorial panel */}
                          <div className="col-span-4 bg-[#15294A] p-5 flex flex-col justify-between">
                            <div className="space-y-2">
                              <span className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#C49A4E] block">
                                {tx(EDITORIAL[item.label]?.tag ?? 'FEATURED')}
                              </span>
                              <h5 className="text-[15px] font-bold text-[#F4EEDF] leading-snug">
                                {tx(EDITORIAL[item.label]?.title ?? item.label)}
                              </h5>
                              <p className="text-[12.5px] text-[#F4EEDF]/70 leading-relaxed">
                                {tx(EDITORIAL[item.label]?.desc ?? item.description)}
                              </p>
                            </div>
                            <Link
                              href={EDITORIAL[item.label]?.href ?? item.href}
                              className="inline-flex items-center gap-1.5 mt-5 pt-3 border-t border-[#F4EEDF]/[0.08] text-[13px] font-bold text-[#C49A4E] hover:text-[#E4C689] transition-colors"
                            >{t("View details")}{' '}<ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </nav>

            {/* ── ACTION CLUSTER ────────────────────────────────── */}
            <div className="hidden xl:flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                title={t("Search (⌘K)")}
                aria-label={t("Search the platform")}
                className="p-2 rounded-[3px] text-[#15294A]/45 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>

              <div className="hidden 2xl:block w-px h-5 bg-[#15294A]/10 mx-1" />

              <Link
                href="/portal/login"
                title={t("Sign In")}
                className="flex items-center gap-1.5 px-2.5 2xl:px-3.5 py-1.5 text-[13px] font-semibold text-[#15294A] bg-white border border-[#15294A]/20 rounded-[3px] hover:border-[#15294A]/45 transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#C49A4E]" aria-hidden="true" /><span className="sr-only 2xl:not-sr-only">{t("Sign In")}</span></Link>

              <Link
                href="/e-residency"
                className="btn-sovereign-gold flex items-center gap-1.5 px-4 py-[7px] !text-[13.5px] whitespace-nowrap group"
              >
                <span>{t("Apply")}</span>
                <ArrowRight className="w-3 h-3 text-[#0E1B31] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* ── MOBILE HAMBURGER ──────────────────────────────── */}
            <div className="flex items-center gap-1 xl:hidden">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label={t("Search the platform")}
                className="p-2 text-[#15294A]/50 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] rounded-[3px]"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="p-2 text-[#15294A]/50 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] rounded-[3px]"
                aria-label={tx(mobileOpen ? 'Close navigation' : 'Open navigation')}
                aria-expanded={mobileOpen}
              >
                {tx(mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />)}
              </button>
            </div>

          </div>
        </div>

        {/* ── MOBILE DRAWER ────────────────────────────────────── */}
        {tx(mobileOpen && (
          <div className="xl:hidden bg-white border-t border-[#15294A]/[0.07] max-h-[80vh] overflow-y-auto">
            <div className="max-w-screen-xl mx-auto px-4 py-3 space-y-0.5">
              {MAIN_NAVIGATION.map(item => (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[3px] text-[15px] font-semibold transition-colors ${
                      pathname === item.href
                        ? 'bg-[#15294A]/[0.06] text-[#15294A]'
                        : 'text-[#15294A]/80 hover:bg-[#15294A]/[0.04] hover:text-[#15294A]'
                    }`}
                  >
                    {tx(NAV_LABELS[item.label] ?? item.label)}
                    {tx(item.children && <ChevronDown className="w-3.5 h-3.5 text-[#15294A]/25" />)}
                  </Link>
                  {tx(item.children && (
                    <div className="pl-3 py-1 space-y-0.5">
                      {item.children.flatMap(g => g.items).map(sub => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between px-3 py-2 text-[13.5px] text-[#15294A]/70 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] rounded-[3px] transition-colors"
                        >
                          {tx(sub.title)}
                          {tx(sub.status && <StatusBadge status={sub.status} size="sm" />)}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-t border-[#15294A]/[0.07] px-4 py-3 text-[13px]">
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#C49A4E] mb-2">{t("Language")}</span>
              <LanguageLinks tone="light" onSwitch={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-[#15294A]/[0.07] px-4 py-4 flex flex-col gap-2">
              <Link
                href="/e-residency"
                onClick={() => setMobileOpen(false)}
                className="w-full py-3 text-center text-[15px] font-bold text-white bg-[#15294A] rounded-[3px]"
              >{t("Apply for E-Residency")}</Link>
              <Link
                href="/portal/login"
                onClick={() => setMobileOpen(false)}
                className="w-full py-3 text-center text-[15px] font-semibold text-[#15294A] border border-[#15294A]/25 rounded-[3px]"
              >{t("Citizen Sign In")}</Link>
            </div>
          </div>
        ))}
      </header>

      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
