// Roles and permissions for the workbench (brief §12). Pure functions: no I/O, exhaustively
// tested. Every workbench page and action asks these on the server; hidden menu items are
// a convenience, never the control.

export const ROLES = ["administrator", "reviewer", "publisher", "auditor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  administrator: "Administrator",
  reviewer: "Reviewer",
  publisher: "Publishing officer",
  auditor: "Auditor",
};

export type Permission = "interest.read" | "interest.update" | "cv.download" | "audit.read" | "users.read" | "users.manage";

const GRANTS: Record<Role, readonly Permission[]> = {
  // Platform administration is separate from institutional authority (brief §11):
  // administrators manage accounts but do not read registrations unless also reviewers.
  administrator: ["users.read", "users.manage", "audit.read"],
  reviewer: ["interest.read", "interest.update", "cv.download"],
  publisher: [],
  auditor: ["audit.read"],
};

export type Actor = { id: string; roles: readonly Role[]; disabled?: boolean };

export function can(actor: Actor | null, permission: Permission): boolean {
  if (!actor || actor.disabled) return false;
  return actor.roles.some((r) => GRANTS[r]?.includes(permission));
}

/** No privilege self-assignment (brief §1.9): nobody changes their own roles or status. */
export function canManageUser(actor: Actor | null, targetId: string): boolean {
  return can(actor, "users.manage") && actor!.id !== targetId;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
