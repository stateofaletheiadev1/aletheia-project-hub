'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  LayoutDashboard, Users, UserCheck, UserX, Stamp,
  Building2, ShieldAlert, FileSearch, Globe2, Activity,
  Settings, LogOut, ChevronRight, Bell, Search, Menu, X, Lock, Home, ArrowLeft,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { label: 'Command Dashboard', href: '/admin', badge: null, badgeColor: '' },
      { label: 'Live Activity Feed', href: '/admin/activity', badge: 'Live', badgeColor: 'bg-laurel/20 text-laurel' },
    ],
  },
  {
    title: 'Citizens & Identity',
    items: [
      { label: 'Citizen Registry', href: '/admin/citizens', badge: '2,841', badgeColor: 'bg-parchment/10 text-parchment/60' },
      { label: 'Citizenship Approvals', href: '/admin/citizenship', badge: '12', badgeColor: 'bg-gold/20 text-gold' },
      { label: 'Citizenship Rescissions', href: '/admin/rescissions', badge: null, badgeColor: '' },
    ],
  },
  {
    title: 'Immigration & Visas',
    items: [
      { label: 'Visa Applications', href: '/admin/immigration', badge: '7', badgeColor: 'bg-gold/20 text-gold' },
      { label: 'E-Residency Queue', href: '/admin/e-residency', badge: '24', badgeColor: 'bg-gold/20 text-gold' },
    ],
  },
  {
    title: 'Corporate Registry',
    items: [
      { label: 'Company Formations', href: '/admin/companies', badge: '5', badgeColor: 'bg-gold/20 text-gold' },
      { label: 'Document Review', href: '/admin/documents', badge: null, badgeColor: '' },
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
  '/admin/security': ShieldAlert,
  '/admin/settings': Settings,
};

import { getOfficerSession, clearOfficerSession } from '@/lib/auth';

export function AdminShell({ children, officialName, officialRole }: { children: React.ReactNode; officialName?: string; officialRole?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [officer, setOfficer] = useState({
    name: officialName || 'Cmdr. S. Okafor',
    role: officialRole || 'ADSS Senior Registry Officer',
  });

  React.useEffect(() => {
    const sess = getOfficerSession();
    if (sess) {
      setOfficer({
        name: officialName || sess.name,
        role: officialRole || sess.role,
      });
    }
  }, [officialName, officialRole]);

  const handleLogout = () => {
    clearOfficerSession();
    router.push('/admin/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0B0F1A', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col border-r transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: '#0E1B31', borderColor: 'rgba(196,154,78,0.15)' }}>

        {/* Logo & Return Link */}
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-4 shrink-0 hover:bg-white/5 transition-colors group"
          title="Return to Main Sovereign Platform"
          style={{ borderBottom: '1px solid rgba(196,154,78,0.15)' }}
        >
          <StarOfTruth size={20} />
          <div>
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold group-hover:text-gold-tint transition-colors flex items-center gap-1.5">
              <span>Aletheia ADSS</span>
              <span className="text-[9px] font-normal text-parchment/40">· ← Home</span>
            </div>
            <div className="text-[9px] text-parchment/40 tracking-wide">adss.oiss.stateofaletheia.org</div>
          </div>
          <button
            type="button"
            className="ml-auto lg:hidden text-parchment/40"
            onClick={(e) => {
              e.preventDefault();
              setSidebarOpen(false);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </Link>

        {/* Official badge */}
        <div className="mx-3 my-3 px-3 py-2.5 rounded-sm" style={{ background: 'rgba(14,27,49,0.8)', border: '1px solid rgba(196,154,78,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(196,154,78,0.25), rgba(196,154,78,0.08))', border: '1px solid rgba(196,154,78,0.3)' }}>
              <Lock className="w-3.5 h-3.5 text-gold" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-parchment truncate">{officer.name}</div>
              <div className="text-[9px] text-parchment/40 truncate">{officer.role}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-laurel animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-laurel">SESSION ACTIVE</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {NAV_SECTIONS.map(({ title, items }) => (
            <div key={title}>
              <div className="text-[9px] font-bold tracking-[0.22em] uppercase px-2 mb-1" style={{ color: 'rgba(244,238,223,0.25)' }}>{title}</div>
              <div className="space-y-0.5">
                {items.map(({ label, href, badge, badgeColor }) => {
                  const Icon = NAV_ICONS[href] || LayoutDashboard;
                  const active = pathname === href;
                  return (
                    <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-medium transition-all group ${active ? '' : ''}`}
                      style={{
                        color: active ? '#C49A4E' : 'rgba(244,238,223,0.50)',
                        background: active ? 'rgba(196,154,78,0.12)' : 'transparent',
                        borderLeft: active ? '2px solid #C49A4E' : '2px solid transparent',
                      }}
                    >
                      <Icon className="w-4 h-4 shrink-0" style={{ color: active ? '#C49A4E' : 'rgba(244,238,223,0.35)' }} />
                      <span className="flex-1 truncate">{label}</span>
                      {badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${badgeColor}`}>{badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Return to Public Platform & Logout */}
        <div className="px-3 py-3 shrink-0 space-y-1.5" style={{ borderTop: '1px solid rgba(196,154,78,0.15)' }}>
          <Link
            href="/"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-medium transition-colors hover:bg-white/10 text-gold"
          >
            <Home className="w-4 h-4 shrink-0 text-gold" />
            <span>Back to Main Website</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[12px] font-medium transition-colors hover:bg-red-500/10 text-left"
            style={{ color: 'rgba(252,165,165,0.85)' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out of Console</span>
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-5 shrink-0" style={{ background: 'rgba(14,27,49,0.9)', borderBottom: '1px solid rgba(196,154,78,0.12)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-parchment/50" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'rgba(244,238,223,0.4)' }}>
              <span className="text-gold">ADSS Console</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-parchment/60">
                {NAV_SECTIONS.flatMap(s => s.items).find(i => i.href === pathname)?.label ?? 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#0E1B31] border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/15 transition-colors shadow-sm"
              title="Return to Sovereign National Website"
            >
              <Home className="w-3.5 h-3.5 text-gold" />
              <span className="hidden sm:inline">Back to Main Website</span>
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-sm text-[11px] w-44" style={{ background: 'rgba(14,27,49,0.8)', border: '1px solid rgba(196,154,78,0.15)', color: 'rgba(244,238,223,0.35)' }}>
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Search citizens...</span>
            </div>
            <button className="relative" style={{ color: 'rgba(244,238,223,0.4)' }}>
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ background: '#701824' }}>3</span>
            </button>
            <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-sm text-[9px] font-mono font-bold" style={{ background: 'rgba(112,24,36,0.25)', border: '1px solid rgba(112,24,36,0.5)', color: '#fca5a5' }}>
              <ShieldAlert className="w-3 h-3" /> RESTRICTED
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: '#0B0F1A' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
