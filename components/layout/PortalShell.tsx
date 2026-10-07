'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState, useMemo } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import Link from '@/components/i18n/Link';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  LayoutDashboard,
  FileText,
  Building2,
  CreditCard,
  ShieldCheck,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Fingerprint,
  Globe2,
  Clock,
  Home,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  badge?: string | null;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'My Dashboard',
    items: [
      { label: 'Overview', href: '/portal' },
      { label: 'Notifications', href: '/portal/notifications', badge: '3', badgeColor: 'bg-gold/12 text-gold border border-gold/20' },
    ],
  },
  {
    title: 'Identity & Status',
    items: [
      { label: 'My Digital Identity', href: '/portal/identity' },
      { label: 'Residency Status', href: '/portal/residency' },
      { label: 'Biometric Credentials', href: '/portal/biometrics' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'My Documents', href: '/portal/documents' },
      { label: 'Applications', href: '/portal/apply', badge: '1 Pending', badgeColor: 'bg-gold/12 text-gold border border-gold/20' },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'My Companies', href: '/portal/companies' },
      { label: 'AEY Wallet', href: '/portal/wallet' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile Settings', href: '/portal/settings' },
    ],
  },
];

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  '/portal': LayoutDashboard,
  '/portal/notifications': Bell,
  '/portal/identity': Fingerprint,
  '/portal/residency': Globe2,
  '/portal/biometrics': ShieldCheck,
  '/portal/documents': FileText,
  '/portal/apply': Clock,
  '/portal/companies': Building2,
  '/portal/wallet': CreditCard,
  '/portal/settings': Settings,
};

import { getUserSession, clearUserSession } from '@/lib/auth';

export function PortalShell({ children, userName, userStatus }: { children: React.ReactNode; userName?: string; userStatus?: string }) {
  const { t, tx } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mounted = useHydrated();
  const user = useMemo(() => {
    const sess = mounted ? getUserSession() : null;
    return {
      name: userName || sess?.name || 'Dr. Elena Vasquez',
      status: userStatus || sess?.status || 'E-Resident · Verified',
      initials: sess?.avatarInitials || 'EV',
    };
  }, [mounted, userName, userStatus]);

  const handleLogout = () => {
    clearUserSession();
    router.push('/portal/login');
  };

  const currentLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => i.href === pathname)?.label ?? 'Dashboard';

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#F2EFE6', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}
    >
      {/* Mobile overlay */}
      {tx(sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(21,41,74,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      ))}

      {/* ─── LEFT SIDEBAR ─── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          background: 'linear-gradient(180deg, #15294A 0%, #112240 50%, #0D1B35 100%)',
          borderRight: '1px solid rgba(196,154,78,0.16)',
        }}
      >
        {/* Top gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,154,78,0.70), transparent)' }} />
        <div className="absolute top-0 left-0 right-0 h-28 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(196,154,78,0.10) 0%, transparent 70%)' }} />

        {/* Logo row */}
        <Link
          href="/"
          className="relative flex items-center gap-3 px-5 py-[18px] shrink-0 group transition-all hover:bg-white/[0.03]"
          title={t("Return to Main Sovereign Website")}
          style={{ borderBottom: '1px solid rgba(196,154,78,0.12)' }}
        >
          <div className="w-8 h-8 shrink-0 rounded-sm flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(196,154,78,0.22), rgba(196,154,78,0.06))', border: '1px solid rgba(196,154,78,0.30)' }}>
            <StarOfTruth size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold group-hover:text-gold-tint transition-colors">{t("Aletheia Portal")}</div>
            <div className="text-[9px] tracking-wide" style={{ color: 'rgba(244,238,223,0.38)' }}>{t("Civic Services · Secure Access")}</div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Home className="w-3 h-3" style={{ color: 'rgba(196,154,78,0.65)' }} />
          </div>
          <button
            type="button"
            className="ml-auto lg:hidden hover:text-parchment/70 transition-colors"
            style={{ color: 'rgba(244,238,223,0.40)' }}
            onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}
          >
            <X className="w-4 h-4" />
          </button>
        </Link>

        {/* User Identity Badge */}
        <div className="mx-4 my-4 px-4 py-3.5 rounded-sm shrink-0 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,154,78,0.18)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,154,78,0.45), transparent)' }} />
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0 text-[13px] font-extrabold text-navy"
              style={{ background: 'linear-gradient(135deg, #F0D88A, #C49A4E)', boxShadow: '0 0 14px rgba(196,154,78,0.28)' }}
            >
              {tx(user.initials)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold truncate" style={{ color: '#F4EEDF' }}>{tx(user.name)}</div>
              <div className="text-[9px] truncate mt-0.5" style={{ color: 'rgba(244,238,223,0.42)' }}>{tx(user.status)}</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: '#3D8664' }}>{t("IDENTITY VERIFIED")}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,78,0.10) transparent' }}>
          {NAV_SECTIONS.map(({ title, items }, sIdx) => (
            <div key={title} className={mounted ? 'animate-sidebar-reveal' : ''} style={{ animationDelay: `${sIdx * 35}ms` }}>
              <div className="sidebar-section-title">{tx(title)}</div>
              <div className="space-y-0.5">
                {items.map(({ label, href, badge, badgeColor }) => {
                  const Icon = NAV_ICONS[href] || LayoutDashboard;
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-medium transition-all group/item relative overflow-hidden ${active ? 'nav-item-active' : ''}`}
                      style={active ? {} : { color: 'rgba(244,238,223,0.48)' }}
                    >
                      {tx(!active && (
                        <span className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity rounded-sm" style={{ background: 'rgba(196,154,78,0.05)' }} />
                      ))}
                      <Icon
                        className="w-4 h-4 shrink-0 relative z-10 transition-colors"
                        style={{ color: active ? '#C49A4E' : 'rgba(244,238,223,0.30)' }}
                      />
                      <span className="flex-1 truncate relative z-10 group-hover/item:text-parchment/80 transition-colors">{tx(label)}</span>
                      {tx(badge && (
                        <span className={`sidebar-badge relative z-10 ${badgeColor}`}>{tx(badge)}</span>
                      ))}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer links */}
        <div className="px-3 py-3 shrink-0 space-y-1" style={{ borderTop: '1px solid rgba(196,154,78,0.12)' }}>
          <Link
            href="/"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-semibold transition-all hover:bg-white/[0.04] group/home"
            style={{ color: 'rgba(196,154,78,0.70)' }}
          >
            <Home className="w-4 h-4 shrink-0 transition-transform group-hover/home:-translate-x-0.5" />
            <span>{t("Return to Public Platform")}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-semibold transition-all hover:bg-red-500/8 text-left group/logout"
            style={{ color: 'rgba(252,165,165,0.65)' }}
          >
            <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover/logout:translate-x-0.5" />
            <span>{t("Sign Out")}</span>
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="h-14 flex items-center justify-between px-5 shrink-0"
          style={{
            background: 'rgba(255,255,255,0.92)',
            borderBottom: '1px solid rgba(21,41,74,0.08)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            boxShadow: '0 1px 0 rgba(21,41,74,0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden transition-colors"
              style={{ color: 'rgba(21,41,74,0.50)' }}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
              <span className="font-extrabold" style={{ color: '#15294A' }}>{t("Portal")}</span>
              <ChevronRight className="w-3 h-3" style={{ color: 'rgba(21,41,74,0.30)' }} />
              <span style={{ color: 'rgba(21,41,74,0.55)' }}>{tx(currentLabel)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Return to main website */}
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all btn-shimmer"
              style={{ background: '#FFFFFF', border: '1px solid rgba(21,41,74,0.12)', color: '#15294A', boxShadow: '0 1px 3px rgba(21,41,74,0.06)' }}
              title={t("Return to Sovereign National Website")}
            >
              <Home className="w-3.5 h-3.5" style={{ color: '#C49A4E' }} />
              <span>{t("Main Website")}</span>
            </Link>

            {/* Notifications */}
            <button className="relative p-1.5 rounded-sm transition-colors hover:bg-navy/5" style={{ color: 'rgba(21,41,74,0.45)' }}>
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-extrabold text-white" style={{ background: 'linear-gradient(135deg, #C49A4E, #8F6A2A)' }}>3</span>
            </button>

            {/* Verified badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold status-pill-green">
              <ShieldCheck className="w-3 h-3" />{t("Verified")}</div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: '#F2EFE6', scrollbarWidth: 'thin', scrollbarColor: 'rgba(21,41,74,0.10) transparent' }}
        >
          {tx(children)}
        </main>
      </div>
    </div>
  );
}
