// What the browser receives about the signed-in person (see lib/server/accounts.ts and
// lib/server/officers.ts). Sessions themselves live on the server in HttpOnly cookies.

export interface PortalAccount {
  id: string;
  accountId: string;
  name: string;
  email: string;
  status: 'registered' | 'e-resident' | 'citizen' | 'suspended';
  statusLabel: string;
  role: string;
  avatarInitials: string;
  did: string;
  publicKey: string | null;
  keyRotatedAt: string | null;
  nationality: string | null;
  dob: string | null;
  residency: { validFrom: string; validUntil: string } | null;
  nationalId: string | null;
  passportNumber: string | null;
  balance: number;
  notifyEmail: boolean;
  notifyLedger: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface OfficerProfile {
  id: string;
  officerId: string;
  name: string;
  email: string;
  role: string;
  isAdministrator: boolean;
  clearance: string;
  department: string;
  badgeNumber: string;
  tokenType: string;
  disabled: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  category: 'Identity' | 'Corporate' | 'Financial';
  timestamp: string;
  unread: boolean;
  linkText: string | null;
  linkHref: string | null;
}

export interface PortalDocument {
  id: string;
  reference: string;
  direction: 'issued' | 'submitted';
  kind: 'e-residence-certificate' | 'company-charter' | 'tax-residency' | 'apostille' | 'digital-credential' | null;
  name: string;
  type: string;
  holder: string;
  authority: string | null;
  hash: string;
  size: number;
  contentType: string;
  hasFile: boolean;
  status: 'Verified' | 'Pending Review' | 'Flagged';
  createdAt: string;
  reviewNote: string | null;
  relatedId: string | null;
}

export interface CompanyRecord {
  id: string;
  regNumber: string;
  name: string;
  structure: 'SARL (Limited)' | 'AG (Corporation)' | 'Maritime Trust';
  founder: string;
  shareCapital: number;
  beneficialOwners: string;
  purpose: string;
  status: 'Pending Review' | 'Active / Chartered' | 'Changes Requested';
  submittedAt: string;
  decidedAt: string | null;
  note: string | null;
}

export interface ApplicationSummary {
  id: string;
  reference: string;
  type: 'e-residency' | 'citizenship';
  route: 'e-residency' | 'naturalisation' | 'investor';
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

export const ME = '/api/portal/me';
export const OFFICER_ME = '/api/admin/me';

/** Shortens a 64-hex hash for display: "0a504402…1266". */
export const shortHash = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h);

/** "12 Oct 2026" in the reader's language. */
export const day = (iso: string | null | undefined, intl = 'en-GB') =>
  iso ? new Date(iso).toLocaleDateString(intl, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
