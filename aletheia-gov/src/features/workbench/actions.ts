"use server";

import { revalidatePath } from "next/cache";
import { ConflictError } from "@aletheia/aletheiadb";
import { z } from "zod";
import { database } from "@/server/aletheiadb/client";
import { requirePermission } from "@/server/auth/current-user";
import { canManageUser, isRole, type Role } from "@/server/authorization/policies";
import { audit } from "@/server/services/audit";
import { registrations, type InterestStatus } from "@/server/services/interest";
import { countAdministrators, createUser, getUser, setDisabled, setPassword, setRoles } from "@/server/services/users";

export type ActionState = { error?: string; done?: string };

// ------------------------------------------------------------- registrations of interest

const STATUSES: InterestStatus[] = ["new", "contacted", "archived"];

export async function setInterestStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("interest.update");
  const reference = String(form.get("reference") ?? "");
  const status = String(form.get("status") ?? "") as InterestStatus;
  const rev = Number(form.get("rev"));
  if (!STATUSES.includes(status) || !Number.isInteger(rev)) return { error: "Choose a valid status." };
  const db = database()!;
  const reg = await registrations(db).findOne({ reference });
  if (!reg) return { error: "This registration no longer exists." };
  try {
    await registrations(db).updateOne(reg._id, rev, { $set: { status, updatedAt: new Date().toISOString() } });
  } catch (e) {
    if (e instanceof ConflictError) return { error: "Someone else changed this registration since you opened it. Reload the page and try again." };
    throw e;
  }
  await audit({ actorId: user.id, action: "interest.status", target: { type: "interest", id: reference }, outcome: "success", details: { from: reg.status, to: status } });
  revalidatePath(`/workbench/interest/${reference}`);
  return { done: `Status set to ${status}.` };
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
