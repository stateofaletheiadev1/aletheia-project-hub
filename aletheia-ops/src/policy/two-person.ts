// The two-person rule for privileged changes (brief §18.5): one administrator proposes, a
// different administrator confirms. Nobody proposes or confirms a change to their own access,
// and a proposer can never confirm their own proposal.

import { can, PRIVILEGED_ROLES, type Actor, type Grant, type Role } from "./roles";

export type AccessChange =
  | { kind: "grant"; target: string; grant: Grant }
  | { kind: "revoke_grant"; target: string; grant: Grant }
  | { kind: "workflow_policy"; register: string; version: number };

export type Refusal = { ok: false; reason: string };
export type Allowed = { ok: true };

/** Administrator roles may only be granted or removed by government-wide administrators. */
const ADMIN_ROLES: readonly Role[] = ["system_administrator", "government_administrator", "institutional_administrator"];

/** Changes that need a second administrator. Ordinary role grants take effect on one signature. */
export function needsSecondAdministrator(change: AccessChange): boolean {
  if (change.kind === "workflow_policy") return true;
  return PRIVILEGED_ROLES.includes(change.grant.role);
}

function scopeOf(change: AccessChange): string | undefined {
  return change.kind === "workflow_policy" ? undefined : change.grant.institution === "*" ? undefined : change.grant.institution;
}

export function mayPropose(actor: Actor, change: AccessChange): Allowed | Refusal {
  if (change.kind === "workflow_policy") {
    return can(actor, "policy.propose") ? { ok: true } : { ok: false, reason: "You cannot propose workflow policy changes." };
  }
  if (change.target === actor.id) return { ok: false, reason: "Nobody can change their own access. Ask another administrator." };
  const scope = scopeOf(change);
  if (!can(actor, "role.propose", { institution: scope })) {
    return { ok: false, reason: "You cannot change access for this institution." };
  }
  if ((ADMIN_ROLES.includes(change.grant.role) || change.grant.institution === "*") && !can(actor, "role.propose")) {
    return { ok: false, reason: "Only a government-wide administrator can grant or remove administrator roles or government-wide access." };
  }
  if (change.grant.role === "system_administrator" && !actor.grants.some((g) => g.role === "system_administrator")) {
    return { ok: false, reason: "Only a system administrator can propose another system administrator." };
  }
  return { ok: true };
}

export function mayConfirm(actor: Actor, change: AccessChange, proposedBy: string): Allowed | Refusal {
  if (proposedBy === actor.id) return { ok: false, reason: "A change must be confirmed by a different administrator from the one who proposed it." };
  if (change.kind === "workflow_policy") {
    return can(actor, "policy.confirm") ? { ok: true } : { ok: false, reason: "You cannot confirm workflow policy changes." };
  }
  if (change.target === actor.id) return { ok: false, reason: "Nobody can confirm a change to their own access." };
  if (!can(actor, "role.confirm", { institution: scopeOf(change) })) {
    return { ok: false, reason: "You cannot confirm access changes for this institution." };
  }
  if ((ADMIN_ROLES.includes(change.grant.role) || change.grant.institution === "*") && !can(actor, "role.confirm")) {
    return { ok: false, reason: "Only a government-wide administrator can confirm administrator roles or government-wide access." };
  }
  return { ok: true };
}
