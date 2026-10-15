// Stored shapes for identity (ADR 0004). Officials' names are kept in clear because they sign
// records; email addresses are sealed and found by a keyed blind index.

import type { AccountState } from "@/domain/glossary";
import type { Grant } from "@/policy/roles";
import type { AccessChange } from "@/policy/two-person";

export type Official = {
  id: string;
  name: string;
  emailIndex: string;
  emailSealed: string;
  state: AccountState;
  grants: Grant[];
  passwordHash: string | null;
  totpSealed: string | null;
  totpLastStep: number | null;
  failedAttempts: number;
  lockedUntil: string | null;
  /** Bumped to end every session at once (suspension, password change, sign out everywhere). */
  sessionVersion: number;
  timezone: string;
  density: "comfortable" | "compact";
  invitedBy: string | null;
  createdAt: string;
  activatedAt: string | null;
  lastSignInAt: string | null;
};

export type Invitation = {
  id: string;
  tokenHash: string;
  officialId: string;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  /** Set when the password step is done; the authenticator step completes the invitation. */
  passwordHash: string | null;
  totpSealed: string | null;
};

export type Session = {
  id: string;
  tokenHash: string;
  officialId: string;
  /** "mfa": password checked, authenticator pending. "full": signed in. */
  stage: "mfa" | "full";
  sessionVersion: number;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  device: string;
  /** Sign-in enrolment of an authenticator for an account that has none (ADR 0007), sealed. */
  enrolSealed?: string;
};

export type PendingChange = {
  id: string;
  change: AccessChange;
  /** The official whose access changes, for lookups ("" for policy changes). */
  target: string;
  proposedBy: string;
  proposedAt: string;
  reason: string;
  status: "pending" | "confirmed" | "rejected" | "withdrawn";
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
};

export const MFA_STAGE_MINUTES = 10;
export const IDLE_MINUTES = 30;
export const ABSOLUTE_HOURS = 12;
export const INVITATION_HOURS = 72;
export const LOCK_AFTER_FAILURES = 10;
export const LOCK_MINUTES = 15;
