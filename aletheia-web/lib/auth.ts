'use client';

export interface UserSession {
  id: string;
  name: string;
  role: string;
  status: string;
  avatarInitials: string;
  did: string;
  aeyBalance: string;
}

export interface OfficerSession {
  id: string;
  name: string;
  role: string;
  clearance: string;
  department: string;
  badgeNumber: string;
  tokenType: string;
}

const DEFAULT_USER: UserSession = {
  id: 'ALE-ERES-2026-004928',
  name: 'Dr. Elena Vasquez',
  role: 'E-Resident · Founder',
  status: 'E-Resident · Verified Tier I',
  avatarInitials: 'EV',
  did: 'did:aletheia:AL:qp3f3ak4x56xchdg3n39eny2hs0xrhs25jvz7x64zv292slrn63pwhrwyxt',
  aeyBalance: '12,400.00',
};

const DEFAULT_OFFICER: OfficerSession = {
  id: 'SEC-OFFICER-0091',
  name: 'Cmdr. S. Okafor',
  role: 'ADSS Senior Registry Officer',
  clearance: 'Level 4 Clearance (National Registry)',
  department: 'General Secretariat of State & ADSS Registry',
  badgeNumber: 'ADSS-9041',
  tokenType: 'PIV/CAC Sovereign Hardware Token',
};

const USER_SESSION_KEY = 'aletheia_civic_session';
const OFFICER_SESSION_KEY = 'aletheia_officer_session';

export function getUserSession(): UserSession {
  if (typeof window === 'undefined') return DEFAULT_USER;
  try {
    const raw = sessionStorage.getItem(USER_SESSION_KEY) || localStorage.getItem(USER_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return DEFAULT_USER;
}

export function setUserSession(user: Partial<UserSession>): UserSession {
  const merged = { ...DEFAULT_USER, ...user };
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(merged));
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(merged));
  }
  return merged;
}

export function clearUserSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(USER_SESSION_KEY);
  }
}

export function getOfficerSession(): OfficerSession {
  if (typeof window === 'undefined') return DEFAULT_OFFICER;
  try {
    const raw = sessionStorage.getItem(OFFICER_SESSION_KEY) || localStorage.getItem(OFFICER_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return DEFAULT_OFFICER;
}

export function setOfficerSession(officer: Partial<OfficerSession>): OfficerSession {
  const merged = { ...DEFAULT_OFFICER, ...officer };
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(OFFICER_SESSION_KEY, JSON.stringify(merged));
    localStorage.setItem(OFFICER_SESSION_KEY, JSON.stringify(merged));
  }
  return merged;
}

export function clearOfficerSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(OFFICER_SESSION_KEY);
    localStorage.removeItem(OFFICER_SESSION_KEY);
  }
}
