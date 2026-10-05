'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Globe,
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
    desc: 'Complete architectural specification of the sovereign maritime republic.',
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
    desc: '100% reserve-backed sovereign unit of account governed by supply invariants.',
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
  const pathname = usePathname();
  const [activeMenu, setActiveMenu]   = useState<string | null>(null);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [scrolled,   setScrolled]     = useState(false);
  const [langOpen,   setLangOpen]     = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* scroll shadow */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* route changes → close everything */
  useEffect(() => {
    setActiveMenu(null); setMobileOpen(false);
    setSearchOpen(false); setLangOpen(false);
  }, [pathname]);

  /* keyboard */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setActiveMenu(null); setMobileOpen(false); setLangOpen(false); }
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
          <div className="flex items-center gap-3 text-[10px] leading-none">
            <span className="flex items-center gap-1.5 font-bold tracking-[0.16em] uppercase text-[#C49A4E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C49A4E] animate-pulse" />
              Digital Platform
            </span>
            <span className="text-white/20">|</span>
            <span className="text-white/45 tracking-wide">
              The Covenant State of Aletheia
            </span>
            <span className="text-white/20">|</span>
            <span className="italic font-serif text-[#C49A4E]/70">Veritas in Foedere</span>
          </div>

          {/* right: utilities */}
          <div className="flex items-center gap-4 text-[10px] text-white/40 leading-none">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search the platform (Ctrl or Command + K)"
              className="flex items-center gap-1 hover:text-[#C49A4E] transition-colors"
            >
              <Search className="w-2.5 h-2.5" /> ⌘K
            </button>
            <span className="text-white/15">|</span>
            <Link href="/transparency" className="hover:text-[#C49A4E] transition-colors">
              Public Ledger Audit
            </Link>
            <span className="text-white/15">|</span>

            {/* language */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(v => !v)}
                aria-haspopup="true"
                aria-expanded={langOpen}
                aria-label="Choose language"
                className="flex items-center gap-1 hover:text-[#C49A4E] transition-colors"
              >
                <Globe className="w-2.5 h-2.5" /> EN <ChevronDown className="w-2 h-2" />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#0E1B31] border border-[#C49A4E]/30 shadow-2xl z-50">
                  <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-[#C49A4E]/50 border-b border-white/10">
                    5 Official Languages
                  </div>
                  {[
                    { code: 'en', label: 'English (Working)' },
                    { code: 'de', label: 'Deutsch' },
                    { code: 'nl', label: 'Nederlands' },
                    { code: 'sr', label: 'Српски' },
                    { code: 'it', label: 'Italiano' },
                  ].map(l => (
                    <button
                      key={l.code}
                      onClick={() => setLangOpen(false)}
                      className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors flex items-center justify-between ${
                        l.code === 'en'
                          ? 'text-[#C49A4E] bg-white/5'
                          : 'text-white/55 hover:text-[#C49A4E] hover:bg-white/5'
                      }`}
                    >
                      {l.label}
                      {l.code === 'en' && <span className="text-[#C49A4E] text-[8px]">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-white/15">|</span>
            <Link
              href="/admin/login"
              className="flex items-center gap-1 text-[#C49A4E]/70 hover:text-[#C49A4E] transition-colors font-semibold"
            >
              <Shield className="w-2.5 h-2.5" /> Officer Portal
            </Link>
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
              aria-label="Aletheia Home"
              className="flex items-center gap-2.5 shrink-0 group"
            >
              <Image
                src="/coat_of_arms_transparent.png"
                alt="Arms of Aletheia"
                width={36}
                height={42}
                className="object-contain drop-shadow-sm"
                priority
              />
              <div className="flex flex-col leading-none">
                <span className="text-[15px] font-bold tracking-[0.18em] uppercase text-[#15294A] group-hover:text-[#15294A] whitespace-nowrap">
                  ALETHEIA
                </span>
                <span className="text-[8.5px] font-semibold tracking-[0.16em] uppercase text-[#C49A4E] whitespace-nowrap mt-0.5">
                  Covenant State
                </span>
              </div>
            </Link>

            {/* ── DESKTOP NAV ────────────────────────────────────── */}
            <nav className="hidden xl:flex items-center" aria-label="Primary">
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
                      className={`relative flex items-center gap-0.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap rounded-[3px] transition-colors ${
                        isActive
                          ? 'text-[#15294A]'
                          : 'text-[#15294A]/60 hover:text-[#15294A] hover:bg-[#15294A]/[0.04]'
                      }`}
                    >
                      {/* active indicator */}
                      {isActive && (
                        <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#C49A4E] rounded-full" />
                      )}
                      {label}
                      {hasDropdown && (
                        <ChevronDown
                          className={`ml-0.5 w-3 h-3 text-[#15294A]/30 transition-transform duration-150 ${
                            activeMenu === item.label ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </Link>

                    {/* ── MEGA-MENU ─────────────────────────────── */}
                    {hasDropdown && activeMenu === item.label && (
                      <div
                        className="animate-fade-in absolute left-1/2 -translate-x-1/2 top-[calc(100%+2px)] w-[680px] bg-white border border-[#15294A]/[0.08] shadow-[0_12px_48px_-12px_rgba(21,41,74,0.18)] rounded-[4px] overflow-hidden z-50"
                        onMouseEnter={() => enter(item.label)}
                        onMouseLeave={leave}
                      >
                        <div className="grid grid-cols-12 divide-x divide-[#15294A]/[0.07]">

                          {/* link columns */}
                          <div className="col-span-8 p-5 grid grid-cols-2 gap-x-5 gap-y-0.5">
                            {item.children?.map(group => (
                              <div key={group.group}>
                                <p className="text-[9.5px] font-bold tracking-[0.18em] uppercase text-[#C49A4E] mb-2.5 mt-1">
                                  {group.group}
                                </p>
                                {group.items.map(sub => (
                                  <Link
                                    key={sub.href}
                                    href={sub.href}
                                    className="group/l flex items-start gap-2 px-2 py-1.5 rounded-[3px] hover:bg-[#F6F3EC] transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[12px] font-semibold text-[#15294A] group-hover/l:text-[#C49A4E] transition-colors leading-none">
                                          {sub.title}
                                        </span>
                                        {sub.status && (
                                          <StatusBadge status={sub.status} size="sm" />
                                        )}
                                      </div>
                                      <p className="text-[10.5px] text-[#15294A]/45 mt-0.5 line-clamp-1 leading-snug">
                                        {sub.desc}
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
                              <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#C49A4E]/75 block">
                                {EDITORIAL[item.label]?.tag ?? 'FEATURED'}
                              </span>
                              <h5 className="text-[13px] font-bold text-[#F4EEDF] leading-snug">
                                {EDITORIAL[item.label]?.title ?? item.label}
                              </h5>
                              <p className="text-[10.5px] text-[#F4EEDF]/55 leading-relaxed">
                                {EDITORIAL[item.label]?.desc ?? item.description}
                              </p>
                            </div>
                            <Link
                              href={EDITORIAL[item.label]?.href ?? item.href}
                              className="inline-flex items-center gap-1.5 mt-5 pt-3 border-t border-[#F4EEDF]/[0.08] text-[10px] font-bold text-[#C49A4E] hover:text-[#E4C689] transition-colors uppercase tracking-[0.14em]"
                            >
                              View details <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* ── ACTION CLUSTER ────────────────────────────────── */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                title="Search (⌘K)"
                aria-label="Search the platform"
                className="p-2 rounded-[3px] text-[#15294A]/45 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-[#15294A]/10 mx-1" />

              <Link
                href="/portal/login"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#15294A] bg-white border border-[#C49A4E]/40 rounded-sm hover:border-[#C49A4E] hover:bg-[#FAF7F0] transition-all whitespace-nowrap shadow-sm"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#C49A4E]" />
                Sign In
              </Link>

              <Link
                href="/e-residency"
                className="btn-sovereign-gold flex items-center gap-1.5 px-4 py-1.5 text-[11px] rounded-sm transition-all whitespace-nowrap group"
              >
                <span>Apply</span>
                <ArrowRight className="w-3 h-3 text-[#0E1B31] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* ── MOBILE HAMBURGER ──────────────────────────────── */}
            <div className="flex items-center gap-1 xl:hidden">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search the platform"
                className="p-2 text-[#15294A]/50 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] rounded-[3px]"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="p-2 text-[#15294A]/50 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] rounded-[3px]"
                aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* ── MOBILE DRAWER ────────────────────────────────────── */}
        {mobileOpen && (
          <div className="xl:hidden bg-white border-t border-[#15294A]/[0.07] max-h-[80vh] overflow-y-auto">
            <div className="max-w-screen-xl mx-auto px-4 py-3 space-y-0.5">
              {MAIN_NAVIGATION.map(item => (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[3px] text-[13px] font-semibold transition-colors ${
                      pathname === item.href
                        ? 'bg-[#15294A]/[0.06] text-[#15294A]'
                        : 'text-[#15294A]/65 hover:bg-[#15294A]/[0.04] hover:text-[#15294A]'
                    }`}
                  >
                    {NAV_LABELS[item.label] ?? item.label}
                    {item.children && <ChevronDown className="w-3.5 h-3.5 text-[#15294A]/25" />}
                  </Link>
                  {item.children && (
                    <div className="pl-3 py-1 space-y-0.5">
                      {item.children.flatMap(g => g.items).map(sub => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between px-3 py-1.5 text-[12px] text-[#15294A]/55 hover:text-[#15294A] hover:bg-[#15294A]/[0.04] rounded-[3px] transition-colors"
                        >
                          {sub.title}
                          {sub.status && <StatusBadge status={sub.status} size="sm" />}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-[#15294A]/[0.07] px-4 py-4 flex flex-col gap-2">
              <Link
                href="/e-residency"
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 text-center text-[13px] font-bold text-[#F4EEDF] bg-[#15294A] border border-[#C49A4E]/25 rounded-[3px]"
              >
                Apply for E-Residency
              </Link>
              <Link
                href="/portal/login"
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 text-center text-[13px] font-semibold text-[#15294A] border border-[#15294A]/15 rounded-[3px]"
              >
                Citizen Sign In
              </Link>
            </div>
          </div>
        )}
      </header>

      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
