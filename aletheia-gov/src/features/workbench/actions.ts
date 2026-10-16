"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { canManageUser, isRole, type Role } from "@/server/authorization/policies";
import { audit } from "@/server/services/audit";
import { APPLICATION_STATUS_LABEL, isApplicationStatus } from "@/lib/application-status";
import { changeStatus, StatusConflict } from "@/server/services/applications";
import { countAdministrators, createUser, getUser, setDisabled, setPassword, setRoles } from "@/server/services/users";

export type ActionState = { error?: string; done?: string };

// ------------------------------------------------------------- registrations of interest

// The same change the operations workbench makes through /api/applications: one status,
// wherever it is set.
export async function setInterestStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("interest.update");
  const reference = String(form.get("reference") ?? "");
  const status = String(form.get("status") ?? "");
  const rev = Number(form.get("rev"));
  if (!isApplicationStatus(status) || !Number.isInteger(rev)) return { error: "Choose a valid status." };
  try {
    await changeStatus(reference, status, rev, { id: user.id, name: user.name, via: "portal" });
  } catch (e) {
    if (e instanceof StatusConflict) return { error: e.message };
    throw e;
  }
  revalidatePath(`/workbench/interest/${reference}`);
  return { done: `Status set to ${APPLICATION_STATUS_LABEL[status]}.` };
}

// ------------------------------------------------------------- users (administrators)

const NewUser = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  roles: z.array(z.string().refine(isRole, "Unknown role")).min(1, "Choose at least one role"),
  temporaryPassword: z.string().min(8, "The temporary password needs at least 8 characters").max(200),
});

export async function addUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.manage");
  const parsed = NewUser.safeParse({
    name: form.get("name") ?? "",
    email: form.get("email") ?? "",
    roles: form.getAll("roles").map(String),
    temporaryPassword: form.get("temporaryPassword") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const result = await createUser({ ...parsed.data, roles: parsed.data.roles as Role[], createdBy: admin.id });
  if ("error" in result) return { error: result.error };
  await audit({ actorId: admin.id, action: "user.create", target: { type: "user", id: result.id }, outcome: "success", details: { roles: parsed.data.roles.join(",") } });
  revalidatePath("/workbench/users");
  return { done: `Account created for ${parsed.data.email}. They must choose a new password at first sign-in.` };
}

async function guardTarget(targetId: string) {
  const admin = await requirePermission("users.manage");
  const target = await getUser(targetId);
  if (!target) return { admin, error: "No such account." };
  if (!canManageUser({ id: admin.id, roles: admin.roles }, targetId)) return { admin, error: "You cannot change your own account here." };
  return { admin, target };
}

export async function updateUserRoles(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const g = await guardTarget(id);
  if ("error" in g) return { error: g.error };
  const roles = form.getAll("roles").map(String).filter(isRole);
  if (!roles.length) return { error: "Keep at least one role." };
  if (g.target.roles.includes("administrator") && !roles.includes("administrator") && (await countAdministrators()) <= 1) return { error: "This is the last administrator." };
  await setRoles(id, roles);
  await audit({ actorId: g.admin.id, action: "user.roles", target: { type: "user", id }, outcome: "success", details: { roles: roles.join(",") } });
  revalidatePath("/workbench/users");
  return { done: "Roles updated. The person's sessions were signed out." };
}

export async function toggleUserDisabled(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const g = await guardTarget(id);
  if ("error" in g) return { error: g.error };
  const disable = !g.target.disabled;
  if (disable && g.target.roles.includes("administrator") && (await countAdministrators()) <= 1) return { error: "This is the last administrator." };
  await setDisabled(id, disable);
  await audit({ actorId: g.admin.id, action: disable ? "user.disable" : "user.enable", target: { type: "user", id }, outcome: "success" });
  revalidatePath("/workbench/users");
  return { done: disable ? "Account disabled and signed out." : "Account enabled." };
}

export async function resetUserPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const g = await guardTarget(id);
  if ("error" in g) return { error: g.error };
  const temporary = String(form.get("temporaryPassword") ?? "");
  if (temporary.length < 8) return { error: "The temporary password needs at least 8 characters." };
  await setPassword(id, temporary, { temporary: true });
  await audit({ actorId: g.admin.id, action: "user.reset_password", target: { type: "user", id }, outcome: "success" });
  revalidatePath("/workbench/users");
  return { done: "Temporary password set. They must choose a new one at next sign-in." };
}
