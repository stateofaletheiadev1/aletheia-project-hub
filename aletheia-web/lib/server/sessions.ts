import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { collection } from './db';
import { randomToken, sha256 } from './crypto';

// Server-side sessions: the browser holds a random token in an HttpOnly cookie; the database
// holds only its SHA-256, so a leaked database row cannot be replayed. Signing out deletes
// the row, which ends the session everywhere at once.

export type SessionKind = 'citizen' | 'officer';

export type Session = {
  tokenHash: string;
  kind: SessionKind;
  subjectId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  idleMinutes: number;
  userAgent: string;
};

export const COOKIE: Record<SessionKind, string> = { citizen: 'ale_portal_session', officer: 'ale_officer_session' };
const ABSOLUTE_HOURS = 12;
const TOUCH_AFTER_MS = 60_000;

const sessions = () => collection<Session>('sessions');

export async function createSession(kind: SessionKind, subjectId: string, req: NextRequest, idleMinutes: number): Promise<string> {
  const token = randomToken();
  const now = new Date();
  // Sessions are otherwise removed only when read; clear this person's dead ones at sign-in.
  const { documents: old } = await sessions().find({ subjectId }, { limit: 200 });
  await Promise.all(
    old
      .filter((s) => now.getTime() > Date.parse(s.expiresAt) || now.getTime() - Date.parse(s.lastSeenAt) > s.idleMinutes * 60_000)
      .map((s) => sessions().deleteOne(s._id, s._rev).catch(() => undefined)),
  );
  await sessions().insertOne({
    tokenHash: sha256(token),
    kind,
    subjectId,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ABSOLUTE_HOURS * 3_600_000).toISOString(),
    idleMinutes,
    userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200),
  });
  return token;
}

/** The session behind the request's cookie, if it is valid; slides the idle window. */
export async function readSession(kind: SessionKind, req: NextRequest) {
  const token = req.cookies.get(COOKIE[kind])?.value;
  if (!token || token.length > 100) return null;
  const s = await sessions().findOne({ tokenHash: sha256(token) });
  if (!s || s.kind !== kind) return null;
  const now = Date.now();
  if (now > Date.parse(s.expiresAt) || now - Date.parse(s.lastSeenAt) > s.idleMinutes * 60_000) {
    await sessions().deleteOne(s._id, s._rev).catch(() => undefined);
    return null;
  }
  if (now - Date.parse(s.lastSeenAt) > TOUCH_AFTER_MS) {
    await sessions().updateOne(s._id, s._rev, { $set: { lastSeenAt: new Date(now).toISOString() } }).catch(() => undefined);
  }
  return s;
}

export async function endSession(kind: SessionKind, req: NextRequest): Promise<void> {
  const token = req.cookies.get(COOKIE[kind])?.value;
  if (!token) return;
  const s = await sessions().findOne({ tokenHash: sha256(token) });
  if (s) await sessions().deleteOne(s._id, s._rev).catch(() => undefined);
}

/** Ends every session of a person, except optionally the current one. */
export async function endAllSessions(subjectId: string, exceptId?: string): Promise<void> {
  const { documents } = await sessions().find({ subjectId }, { limit: 1000 });
  await Promise.all(documents.filter((s) => s._id !== exceptId).map((s) => sessions().deleteOne(s._id, s._rev).catch(() => undefined)));
}

export function setSessionCookie(res: NextResponse, kind: SessionKind, token: string): void {
  res.cookies.set(COOKIE[kind], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ABSOLUTE_HOURS * 3600,
  });
}

export function clearSessionCookie(res: NextResponse, kind: SessionKind): void {
  res.cookies.set(COOKIE[kind], '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
}
