'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  LayoutDashboard, User, FileText, Building2, CreditCard,
  Download, ShieldCheck, Bell, Settings, LogOut, ChevronRight,
  Menu, X, Fingerprint, Globe2, Clock, Home, ArrowLeft,
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
      { label: 'Notifications', href: '/portal/notifications', badge: '3', badgeColor: 'bg-gold/20 text-gold' },
    ],
  },
  {
    title: 'Identity & Status',
    items: [
      { label: 'My Digital Identity', href: '/portal/identity', badge: null },
      { label: 'Residency Status', href: '/portal/residency', badge: null },
      { label: 'Biometric Credentials', href: '/portal/biometrics', badge: null },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'My Documents', href: '/portal/documents', badge: null },
      { label: 'Applications', href: '/portal/apply', badge: '1 Pending', badgeColor: 'bg-gold/20 text-gold' },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'My Companies', href: '/portal/companies', badge: null },
      { label: 'AEY Wallet', href: '/portal/wallet', badge: null },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile Settings', href: '/portal/settings', badge: null },
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

import { useRouter } from 'next/navigation';
import { getUserSession, clearUserSession } from '@/lib/auth';

export function PortalShell({ children, userName, userStatus }: { children: React.ReactNode; userName?: string; userStatus?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState({
    name: userName || 'Dr. Elena Vasquez',
    status: userStatus || 'E-Resident · Verified',
    initials: 'EV',
  });

  React.useEffect(() => {
    const sess = getUserSession();
    if (sess) {
      setUser({
        name: userName || sess.name,
        status: userStatus || sess.status,
        initials: sess.avatarInitials || 'EV',
      });
    }
  }, [userName, userStatus]);

  const handleLogout = () => {
    clearUserSession();
    router.push('/portal/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F6F3EC', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: '#15294A', borderRight: '1px solid rgba(196,154,78,0.18)' }}>

        {/* Logo & Return Link */}
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-4 shrink-0 hover:bg-white/5 transition-colors group"
          title="Return to Main Sovereign Website"
          style={{ borderBottom: '1px solid rgba(196,154,78,0.18)' }}
        >
          <StarOfTruth size={20} />
          <div>
            <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold group-hover:text-gold-tint transition-colors flex items-center gap-1.5">
              <span>Aletheia</span>
              <span className="text-[9px] font-normal text-parchment/40">· ← Home</span>
            </div>
            <div className="text-[9px] tracking-wide" style={{ color: 'rgba(244,238,223,0.4)' }}>Civic Services Portal</div>
          </div>
          <button
            type="button"
            className="ml-auto lg:hidden"
            style={{ color: 'rgba(244,238,223,0.4)' }}
            onClick={(e) => {
              e.preventDefault();
              setSidebarOpen(false);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </Link>

        {/* User badge */}
        <div className="mx-3 my-3 px-3 py-3 rounded-sm" style={{ background: 'rgba(14,27,49,0.5)', border: '1px solid rgba(196,154,78,0.18)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-navy" style={{ background: 'linear-gradient(135deg, #E4C689, #C49A4E)' }}>
              {user.initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold truncate" style={{ color: '#F4EEDF' }}>{user.name}</div>
              <div className="text-[9px] truncate" style={{ color: 'rgba(244,238,223,0.45)' }}>{user.status}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2F6B4F' }} />
            <span className="text-[9px] font-mono font-bold" style={{ color: '#3D8664' }}>IDENTITY VERIFIED</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {NAV_SECTIONS.map(({ title, items }) => (
            <div key={title}>
              <div className="text-[9px] font-bold tracking-[0.22em] uppercase px-2 mb-1.5" style={{ color: 'rgba(244,238,223,0.25)' }}>{title}</div>
              <div className="space-y-0.5">
                {items.map(({ label, href, badge, badgeColor }) => {
                  const Icon = NAV_ICONS[href] || LayoutDashboard;
                  const active = pathname === href;
                  return (
                    <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '2px',
                        fontSize: '12px', fontWeight: 500, transition: 'all 150ms',
                        color: active ? '#C49A4E' : 'rgba(244,238,223,0.55)',
                        background: active ? 'rgba(196,154,78,0.10)' : 'transparent',
                        borderLeft: active ? '2px solid #C49A4E' : '2px solid transparent',
                        textDecoration: 'none',
                      }}
                    >
                      <Icon style={{ width: '16px', height: '16px', flexShrink: 0, color: active ? '#C49A4E' : 'rgba(244,238,223,0.35)' }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      {badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${badgeColor}`}>{badge}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Return to Public Website & Logout */}
        <div className="px-3 py-3 shrink-0 space-y-1.5" style={{ borderTop: '1px solid rgba(196,154,78,0.18)' }}>
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
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '2px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'rgba(252,165,165,0.85)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            className="hover:bg-red-500/10 transition-colors"
          >
            <LogOut style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-5 shrink-0" style={{ background: 'rgba(255,255,255,0.9)', borderBottom: '1px solid rgba(21,41,74,0.10)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden" style={{ color: 'rgba(21,41,74,0.5)' }} onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'rgba(21,41,74,0.4)' }}>
              <span style={{ color: '#15294A', fontWeight: 700 }}>Portal</span>
              <ChevronRight className="w-3 h-3" />
              <span>{NAV_SECTIONS.flatMap(s => s.items).find(i => i.href === pathname)?.label ?? 'Dashboard'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white border border-[#15294A]/15 text-[#15294A] text-xs font-semibold hover:border-gold hover:text-gold transition-colors shadow-sm"
              title="Return to Sovereign National Website"
            >
              <Home className="w-3.5 h-3.5 text-gold" />
              <span className="hidden sm:inline">Back to Main Website</span>
            </Link>
            <button className="relative" style={{ color: 'rgba(21,41,74,0.4)' }}>
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ background: '#C49A4E' }}>3</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold" style={{ background: 'rgba(47,107,79,0.10)', border: '1px solid rgba(47,107,79,0.25)', color: '#2F6B4F' }}>
              <ShieldCheck className="w-3 h-3" /> Verified
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: '#F6F3EC' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
