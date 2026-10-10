import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { can, type Permission, type Role } from "@/server/authorization/policies";
import { getUser, getUserView } from "@/server/services/users";
import { openSession, SESSION_COOKIE, type SessionClaims } from "./session";

// Server-side identity for every workbench page and action. Each call re-reads the user,
// so disabling an account, changing roles or signing out everywhere takes effect at once.

export type CurrentUser = { id: string; name: string; email: string; roles: Role[]; mustChangePassword: boolean; session: SessionClaims };

export async function currentUser(): Promise<CurrentUser | null> {
  const claims = await openSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const u = await getUser(claims.uid);
  if (!u || u.disabled || u.sessionVersion !== claims.sv || u.revokedSessions.includes(claims.sid)) return null;
  const v = await getUserView(u._id);
  if (!v) return null;
  return { id: u._id, name: v.name, email: v.email, roles: u.roles, mustChangePassword: u.mustChangePassword, session: claims };
}

/** For pages: signed in (and past any required password change), or sent to sign in. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/workbench/account?first=1");
  return user;
}

/** For pages and actions that need a permission. Unauthorised: 404, not 403 (brief §12.3). */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can({ id: user.id, roles: user.roles }, permission)) notFound();
  return user;
}
