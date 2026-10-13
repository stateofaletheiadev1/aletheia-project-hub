'use client';

import { siteHome } from '@/lib/hosts';
import React, { useState, useMemo, useEffect } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import Link from '@/components/i18n/Link';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserX,
  Stamp,
  Building2,
  ShieldAlert,
  FileSearch,
  Globe2,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Landmark,
  Search,
  Menu,
  X,
  Home,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { label: 'Command Dashboard', href: '/admin', badge: null, badgeColor: '' },
      { label: 'Live Activity Feed', href: '/admin/activity', badge: 'Live', badgeColor: 'bg-laurel/20 text-laurel border border-laurel/20' },
    ],
  },
  {
    title: 'Citizens & Identity',
    items: [
      { label: 'Citizen Registry', href: '/admin/citizens', badge: null, badgeColor: 'bg-parchment/8 text-parchment/50 border border-parchment/10' },
      { label: 'Citizenship Approvals', href: '/admin/citizenship', badge: null, badgeColor: 'bg-gold/15 text-gold border border-gold/20' },
      { label: 'Citizenship Rescissions', href: '/admin/rescissions', badge: null, badgeColor: '' },
    ],
  },
  {
    title: 'Immigration & Visas',
    items: [
      { label: 'Border Control', href: '/admin/immigration', badge: null, badgeColor: 'bg-gold/15 text-gold border border-gold/20' },
      { label: 'E-Residency Queue', href: '/admin/e-residency', badge: null, badgeColor: 'bg-gold/15 text-gold border border-gold/20' },
    ],
  },
  {
    title: 'Corporate Registry',
    items: [
      { label: 'Company Formations', href: '/admin/companies', badge: null, badgeColor: 'bg-gold/15 text-gold border border-gold/20' },
      { label: 'Document Review', href: '/admin/documents', badge: null, badgeColor: '' },
      { label: 'Treasury Issuance', href: '/admin/treasury', badge: null, badgeColor: '' },
    ],
  },
  {
    title: 'Security',
    items: [
      { label: 'Threat Intelligence', href: '/admin/security', badge: null, badgeColor: '' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', href: '/admin/settings', badge: null, badgeColor: '' },
    ],
  },
];

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  '/admin': LayoutDashboard,
  '/admin/activity': Activity,
  '/admin/citizens': Users,
  '/admin/citizenship': UserCheck,
  '/admin/rescissions': UserX,
  '/admin/immigration': Stamp,
  '/admin/e-residency': Globe2,
  '/admin/companies': Building2,
  '/admin/documents': FileSearch,
  '/admin/treasury': Landmark,
  '/admin/security': ShieldAlert,
  '/admin/settings': Settings,
};

import { OFFICER_ME, type OfficerProfile } from '@/lib/auth';
import { api, clearCache, useApi } from '@/lib/client/api';

export type AdminDashboard = {
  stats: { citizens: number; eResidents: number; companies: number; pending: number };
  pending: { eResidency: number; citizenship: number; companies: number; documents: number };
  queue: { id: string; kind: 'application' | 'company'; reference: string; name: string; type: string; nationality: string; date: string }[];
  activity: { time: string; action: string; type: 'success' | 'warning' | 'info' }[];
};
export const ADMIN_DASHBOARD = '/api/admin/dashboard';

export function AdminShell({ children, officialName, officialRole }: { children: React.ReactNode; officialName?: string; officialRole?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mounted = useHydrated();
  const me = useApi<{ officer: OfficerProfile }>(OFFICER_ME);
  const dash = useApi<AdminDashboard>(me.data ? ADMIN_DASHBOARD : null);
  const profile = me.data?.officer;
  const officer = useMemo(() => {
    const name = officialName || profile?.name || '';
    return {
      name,
      role: officialRole || profile?.role || '',
      initials: name.replace(/^(cmdr|dr|capt)\.?\s+/i, '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    };
  }, [profile, officialName, officialRole]);
  const counts: Record<string, number | undefined> = {
    '/admin/citizens': dash.data?.stats.citizens,
    '/admin/citizenship': dash.data?.pending.citizenship,
    '/admin/e-residency': dash.data?.pending.eResidency,
    '/admin/companies': dash.data?.pending.companies,
    '/admin/documents': dash.data?.pending.documents,
  };

  // No valid session: back to sign-in.
  useEffect(() => {
    if (me.error?.status === 401) router.replace('/admin/login');
  }, [me.error, router]);

  const handleLogout = async () => {
    await api('/api/admin/auth/logout', { body: {} }).catch(() => undefined);
    clearCache();
    router.push('/admin/login');
  };

  const currentLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => i.href === pathname)?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#070B14', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── LEFT SIDEBAR ─── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          background: 'linear-gradient(180deg, #0D1628 0%, #0B1220 60%, #080E1C 100%)',
          borderRight: '1px solid rgba(196,154,78,0.13)',
        }}
      >
        {/* Sidebar top glow */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,154,78,0.60), transparent)' }} />
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(196,154,78,0.12) 0%, transparent 70%)' }} />

        {/* Logo & Return */}
        <Link
          href={mounted ? siteHome() : '/'}
          className="relative flex items-center gap-3 px-5 py-[18px] shrink-0 group transition-all hover:bg-white/[0.03]"
          title="Return to Main Sovereign Platform"
          style={{ borderBottom: '1px solid rgba(196,154,78,0.10)' }}
        >
          <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-sm" style={{ background: 'linear-gradient(135deg, rgba(196,154,78,0.20), rgba(196,154,78,0.06))', border: '1px solid rgba(196,154,78,0.28)' }}>
            <StarOfTruth size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold group-hover:text-gold-tint transition-colors flex items-center gap-1.5">
              Aletheia ADSS
            </div>
            <div className="text-[9px] tracking-wide truncate" style={{ color: 'rgba(244,238,223,0.35)' }}>
              adss.oiss.stateofaletheia.org
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Home className="w-3 h-3" style={{ color: 'rgba(196,154,78,0.70)' }} />
          </div>
          {/* Mobile close button */}
          <button
            type="button"
            className="ml-auto lg:hidden text-parchment/40 hover:text-parchment/70 transition-colors"
            onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}
          >
            <X className="w-4 h-4" />
          </button>
        </Link>

        {/* Officer Badge */}
        <div className="mx-4 my-4 px-4 py-3 rounded-sm shrink-0 relative overflow-hidden" style={{ background: 'rgba(196,154,78,0.05)', border: '1px solid rgba(196,154,78,0.16)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,154,78,0.45), transparent)' }} />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0 text-[11px] font-extrabold text-navy" style={{ background: 'linear-gradient(135deg, #E4C689, #C49A4E)', boxShadow: '0 0 12px rgba(196,154,78,0.25)' }}>
              {officer.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold truncate" style={{ color: '#F0E9D8' }}>{officer.name}</div>
              <div className="text-[9px] truncate mt-0.5" style={{ color: 'rgba(244,238,223,0.40)' }}>{officer.role}</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: '#3D8664' }}>SESSION ACTIVE · CLEARANCE L4</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,78,0.12) transparent' }}>
          {NAV_SECTIONS.map(({ title, items }, sIdx) => (
            <div key={title} className={mounted ? 'animate-sidebar-reveal' : ''} style={{ animationDelay: `${sIdx * 40}ms` }}>
              <div className="sidebar-section-title">{title}</div>
              <div className="space-y-0.5">
                {items.map(({ label, href, badge: staticBadge, badgeColor: staticColor }) => {
                  const count = counts[href];
                  const badge = count ? count.toLocaleString('en-GB') : staticBadge;
                  const badgeColor = count ? (href === '/admin/citizens' ? 'bg-parchment/8 text-parchment/50 border border-parchment/10' : 'bg-gold/15 text-gold border border-gold/20') : staticColor;
                  const Icon = NAV_ICONS[href] || LayoutDashboard;
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-medium transition-all group/item relative overflow-hidden ${active ? 'nav-item-active' : ''}`}
                      style={active ? {} : {
                        color: 'rgba(244,238,223,0.45)',
                      }}
                    >
                      {/* Hover bg */}
                      {!active && (
                        <span className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity rounded-sm" style={{ background: 'rgba(196,154,78,0.05)' }} />
                      )}
                      <Icon
                        className="w-4 h-4 shrink-0 relative z-10 transition-colors"
                        style={{ color: active ? '#C49A4E' : 'rgba(244,238,223,0.28)' }}
                      />
                      <span className="flex-1 truncate relative z-10 group-hover/item:text-parchment/80 transition-colors">{label}</span>
                      {badge && (
                        <span className={`sidebar-badge relative z-10 ${badgeColor}`}>{badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 shrink-0 space-y-1" style={{ borderTop: '1px solid rgba(196,154,78,0.10)' }}>
          <Link
            href={mounted ? siteHome() : '/'}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-semibold transition-all hover:bg-white/[0.04] group/home"
            style={{ color: 'rgba(196,154,78,0.75)' }}
          >
            <Home className="w-4 h-4 shrink-0 transition-transform group-hover/home:-translate-x-0.5" />
            <span>Return to Public Platform</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-semibold transition-all hover:bg-red-500/8 text-left group/logout"
            style={{ color: 'rgba(252,165,165,0.70)' }}
          >
            <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover/logout:translate-x-0.5" />
            <span>Sign Out of Console</span>
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="h-14 flex items-center justify-between px-5 shrink-0 admin-topbar"
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-parchment/50 hover:text-parchment/80 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
              <span className="font-bold" style={{ color: '#C49A4E' }}>ADSS</span>
              <ChevronRight className="w-3 h-3" style={{ color: 'rgba(196,154,78,0.35)' }} />
              <span style={{ color: 'rgba(244,238,223,0.55)' }}>{currentLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Back to website */}
            <Link
              href={mounted ? siteHome() : '/'}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all btn-shimmer"
              style={{ background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.25)', color: '#C49A4E' }}
              title="Return to Sovereign National Website"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Main Website</span>
            </Link>

            {/* Search bar */}
            <Link
              href="/admin/citizens"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-sm text-[11px] w-40 cursor-pointer transition-all hover:border-gold/30"
              style={{ background: 'rgba(14,27,49,0.60)', border: '1px solid rgba(196,154,78,0.12)', color: 'rgba(244,238,223,0.30)' }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Search records…</span>
            </Link>

            {/* Pending work */}
            <Link href="/admin" aria-label="Pending work" className="relative p-1.5 rounded-sm transition-colors hover:bg-white/5" style={{ color: 'rgba(244,238,223,0.45)' }}>
              <Bell className="w-4 h-4" />
              {(dash.data?.stats.pending ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center text-[7px] font-extrabold text-white" style={{ background: 'linear-gradient(135deg, #9B1C2C, #701824)' }}>{dash.data!.stats.pending}</span>
              )}
            </Link>

            {/* Restricted badge */}
            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-sm text-[9px] font-mono font-extrabold tracking-wider" style={{ background: 'rgba(112,24,36,0.20)', border: '1px solid rgba(112,24,36,0.40)', color: '#fca5a5' }}>
              <ShieldAlert className="w-3 h-3" /> RESTRICTED
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#080C18', scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,78,0.12) transparent' }}>
          {profile ? children : (
            <div className="p-8 text-sm font-mono" style={{ color: 'rgba(244,238,223,0.45)' }} role="status">
              {me.error && me.error.status !== 401 ? me.error.message : 'Loading…'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
