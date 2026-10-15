// Roles and permissions (brief §25). Pure data and pure functions; every server action, route
// handler, query and publication call asks `can()` here. Hiding a button is a convenience,
// never the control. docs/security/PERMISSION_MATRIX.md is generated from this file.

import { CLASSIFICATION_RANK, type Classification } from "@/domain/glossary";

export const ROLES = [
  "founder",
  "system_administrator",
  "government_administrator",
  "institutional_administrator",
  "departmental_officer",
  "author",
  "reviewer",
  "approving_officer",
  "publishing_officer",
  "finance_officer",
  "appointments_verifier",
  "auditor",
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "record.read",
  "record.create",
  "record.edit",
  "record.submit",
  "record.review",
  "record.approve",
  "record.adopt",
  "record.verify",
  "record.withdraw",
  "record.archive",
  "record.comment",
  "finance.approve",
  "publication.authorise",
  "publication.publish",
  "task.assign",
  "institution.manage",
  "official.read",
  "official.invite",
  "official.manage",
  "role.propose",
  "role.confirm",
  "policy.propose",
  "policy.confirm",
  "audit.read",
  "publication_log.read",
  "integration.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "record.read": "Read records",
  "record.create": "Create drafts",
  "record.edit": "Edit own drafts and revisions",
  "record.submit": "Submit for review",
  "record.review": "Review, request revision, reject",
  "record.approve": "Approve",
  "record.adopt": "Record adoption of a decision",
  "record.verify": "Verify an appointment",
  "record.withdraw": "Withdraw before publication",
  "record.archive": "Archive",
  "record.comment": "Comment",
  "finance.approve": "Approve finance records",
  "publication.authorise": "Authorise publication",
  "publication.publish": "Publish to the public record",
  "task.assign": "Assign and reassign work",
  "institution.manage": "Manage institutions and positions",
  "official.read": "See officials and their access",
  "official.invite": "Invite officials",
  "official.manage": "Suspend, reinstate or revoke officials",
  "role.propose": "Propose a role grant or removal",
  "role.confirm": "Confirm another administrator's role change",
  "policy.propose": "Propose a workflow policy change",
  "policy.confirm": "Confirm another administrator's policy change",
  "audit.read": "Read the audit register",
  "publication_log.read": "Read the publication log",
  "integration.read": "See integration health",
};

export const ROLE_INFO: Record<Role, { label: string; summary: string; grants: readonly Permission[] }> = {
  founder: {
    label: "Founder",
    summary: "Holds every power in every institution: writes, reviews, approves, releases, and grants roles without a second administrator (ADR 0009).",
    grants: PERMISSIONS,
  },
  system_administrator: {
    label: "System administrator",
    summary: "Runs the system: officials, roles, policies and integrations. Does not handle records.",
    grants: ["official.read", "official.invite", "official.manage", "role.propose", "role.confirm", "policy.propose", "policy.confirm", "audit.read", "publication_log.read", "integration.read"],
  },
  government_administrator: {
    label: "Government administrator",
    summary: "Administers institutions and officials across the government.",
    grants: ["record.read", "institution.manage", "official.read", "official.invite", "official.manage", "role.propose", "role.confirm", "task.assign", "audit.read", "publication_log.read"],
  },
  institutional_administrator: {
    label: "Institutional administrator",
    summary: "Administers one institution: its officials and the assignment of its work.",
    grants: ["record.read", "official.read", "official.invite", "role.propose", "role.confirm", "task.assign", "record.archive"],
  },
  departmental_officer: {
    label: "Departmental officer",
    summary: "Reads the institution's records and comments on them.",
    grants: ["record.read", "record.comment"],
  },
  author: {
    label: "Author",
    summary: "Drafts records and submits them for review.",
    grants: ["record.read", "record.create", "record.edit", "record.submit", "record.withdraw", "record.comment"],
  },
  reviewer: {
    label: "Reviewer",
    summary: "Examines submitted versions; requests revision or rejects with reasons.",
    grants: ["record.read", "record.review", "record.comment"],
  },
  approving_officer: {
    label: "Approving officer",
    summary: "Countersigns versions for the institution, and records adoption of decisions.",
    grants: ["record.read", "record.review", "record.approve", "record.adopt", "record.withdraw", "record.comment"],
  },
  publishing_officer: {
    label: "Publishing officer",
    summary: "Authorises and releases approved records to the public record.",
    grants: ["record.read", "publication.authorise", "publication.publish", "publication_log.read", "record.comment"],
  },
  finance_officer: {
    label: "Finance officer",
    summary: "Approves public finance records.",
    grants: ["record.read", "record.review", "finance.approve", "record.comment"],
  },
  appointments_verifier: {
    label: "Appointments verifier",
    summary: "Verifies appointments before they can be approved.",
    grants: ["record.read", "record.verify", "record.comment"],
  },
  auditor: {
    label: "Auditor",
    summary: "Reads everything it is cleared for, and the audit register. Changes nothing.",
    grants: ["record.read", "audit.read", "publication_log.read", "official.read", "integration.read"],
  },
};

/** Roles whose grant or removal needs a second administrator (brief §18.5). */
export const PRIVILEGED_ROLES: readonly Role[] = [
  "founder",
  "system_administrator",
  "government_administrator",
  "institutional_administrator",
  "approving_officer",
  "publishing_officer",
  "finance_officer",
];

/** One grant: a role, where it applies, and the highest classification it may see there. */
export type Grant = { role: Role; institution: string | "*"; clearance: Classification };

export type Actor = {
  id: string;
  state: "active" | "invited" | "suspended" | "revoked";
  mfa: boolean;
  grants: readonly Grant[];
};

/** Where the permission is being exercised. `institution` absent means a system-wide action. */
export type Scope = { institution?: string; classification?: Classification };

/** Deny by default: an inactive actor, or one without MFA, can do nothing (ADR 0004). */
export function can(actor: Actor | null | undefined, permission: Permission, scope: Scope = {}): boolean {
  if (!actor || actor.state !== "active" || !actor.mfa) return false;
  return actor.grants.some((g) => grantAllows(g, permission, scope));
}

function grantAllows(g: Grant, permission: Permission, scope: Scope): boolean {
  if (!ROLE_INFO[g.role].grants.includes(permission)) return false;
  if (scope.institution !== undefined && g.institution !== "*" && g.institution !== scope.institution) return false;
  if (scope.institution === undefined && g.institution !== "*" && !SYSTEM_PERMISSIONS_FOR_SCOPED.has(permission)) return false;
  if (scope.classification && CLASSIFICATION_RANK[g.clearance] < CLASSIFICATION_RANK[scope.classification]) return false;
  return true;
}

/**
 * Permissions an institution-scoped grant may use without naming an institution, because the
 * caller then filters results to the actor's institutions (for example the officials list).
 */
const SYSTEM_PERMISSIONS_FOR_SCOPED = new Set<Permission>(["record.read", "official.read", "task.assign"]);

/** Institutions where the actor holds `permission` (or "*" for all). */
export function institutionsWhere(actor: Actor | null | undefined, permission: Permission): "*" | string[] {
  if (!actor || actor.state !== "active" || !actor.mfa) return [];
  const ids = new Set<string>();
  for (const g of actor.grants) {
    if (!ROLE_INFO[g.role].grants.includes(permission)) continue;
    if (g.institution === "*") return "*";
    ids.add(g.institution);
  }
  return [...ids];
}

/** Highest classification the actor may read in an institution, or null for none. */
export function clearanceIn(actor: Actor | null | undefined, institution: string): Classification | null {
  let best: Classification | null = null;
  for (const g of actor?.grants ?? []) {
    if (!ROLE_INFO[g.role].grants.includes("record.read")) continue;
    if (g.institution !== "*" && g.institution !== institution) continue;
    if (best === null || CLASSIFICATION_RANK[g.clearance] > CLASSIFICATION_RANK[best]) best = g.clearance;
  }
  return actor && actor.state === "active" && actor.mfa ? best : null;
}

/** May the actor see this record at all? Used for lookups, search, counts and notifications. */
export function canSee(actor: Actor | null | undefined, record: { institution: string; classification: Classification }): boolean {
  const c = clearanceIn(actor, record.institution);
  return c !== null && CLASSIFICATION_RANK[c] >= CLASSIFICATION_RANK[record.classification];
}

/**
 * Founders act on their own authority (ADR 0009): the separation-of-duties rules and the
 * two-person rule bind other officials, not them. Every such act is marked in the audit register.
 */
export function isFounder(actor: Actor | null | undefined): boolean {
  return Boolean(actor && actor.state === "active" && actor.mfa && actor.grants.some((g) => g.role === "founder" && g.institution === "*"));
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
