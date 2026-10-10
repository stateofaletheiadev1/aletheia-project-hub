import { ActionForm } from "@/components/workbench/ActionForm";
import { WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { addUser, resetUserPassword, toggleUserDisabled, updateUserRoles } from "@/features/workbench/actions";
import { formatDateShort } from "@/lib/dates";
import { requirePermission } from "@/server/auth/current-user";
import { can, ROLE_LABEL, ROLES } from "@/server/authorization/policies";
import { listUsers } from "@/server/services/users";

export const metadata = { title: "Users" };

const input = "mt-1.5 block w-full border-0 border-b border-[var(--rule-ledger)] bg-transparent px-0 py-2 text-[0.9375rem] focus:border-navy-800 focus:outline-none focus:ring-0";
const lbl = "text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500";

function RoleChecks({ selected = [] as string[] }) {
  return (
    <fieldset className="mt-3">
      <legend className={lbl}>Roles</legend>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        {ROLES.map((r) => (
          <label key={r} className="flex items-center gap-2 text-[0.9375rem]">
            <input type="checkbox" name="roles" value={r} defaultChecked={selected.includes(r)} className="h-4 w-4 accent-[#15294A]" />
            {ROLE_LABEL[r]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function Users() {
  const me = await requirePermission("users.read");
  const manage = can({ id: me.id, roles: me.roles }, "users.manage");
  const users = await listUsers();

  return (
    <>
      <WorkbenchHeading eyebrow="Administration" title="Users">
        Accounts are created here by an administrator; there is no public sign-up. New accounts and reset passwords are temporary: the person must choose their own
        at next sign-in. Nobody can change their own roles or disable themselves.
      </WorkbenchHeading>

      <ul className="border-t-2 border-navy-800">
        {users.map((u) => (
          <li key={u.id} className="border-b border-[var(--rule-ledger)] py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[1.0625rem] font-medium">
                  {u.name} {u.id === me.id ? <span className="text-[0.8125rem] font-normal text-ink-500">(you)</span> : null}
                </p>
                <p className="text-[0.875rem] text-ink-600">{u.email}</p>
              </div>
              <p className="text-[0.8125rem] text-ink-600">
                {u.roles.map((r) => ROLE_LABEL[r]).join(" · ")}
                {u.disabled ? <span className="ml-3 font-semibold text-[#9b2c2c]">Disabled</span> : null}
                {u.mustChangePassword ? <span className="ml-3 text-[#8a5a00]">Temporary password</span> : null}
                <span className="ml-3 text-ink-500">Last sign-in: {u.lastSignInAt ? formatDateShort(u.lastSignInAt) : "never"}</span>
              </p>
            </div>
            {manage && u.id !== me.id ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.875rem] font-semibold text-navy-800">Manage</summary>
                <div className="mt-4 grid gap-8 border-l-2 border-[var(--rule-ledger)] pl-5 lg:grid-cols-3">
                  <ActionForm action={updateUserRoles} submit="Save roles" tone="quiet">
                    <input type="hidden" name="id" value={u.id} />
                    <RoleChecks selected={u.roles} />
                  </ActionForm>
                  <ActionForm action={resetUserPassword} submit="Set temporary password" tone="quiet">
                    <input type="hidden" name="id" value={u.id} />
                    <label className={lbl}>
                      New temporary password
                      <input name="temporaryPassword" type="password" autoComplete="new-password" minLength={8} required className={input} />
                    </label>
                  </ActionForm>
                  <ActionForm action={toggleUserDisabled} submit={u.disabled ? "Enable account" : "Disable account"} tone={u.disabled ? "quiet" : "danger"}>
                    <input type="hidden" name="id" value={u.id} />
                    <p className="text-[0.875rem] text-ink-600">{u.disabled ? "Lets this person sign in again." : "Signs this person out everywhere and blocks sign-in."}</p>
                  </ActionForm>
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      {manage ? (
        <section aria-labelledby="add" className="mt-14 max-w-2xl">
          <h2 id="add" className="t-h3">
            Add an account
          </h2>
          <ActionForm action={addUser} submit="Create account" className="mt-4">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className={lbl}>
                Full name
                <input name="name" required className={input} autoComplete="off" />
              </label>
              <label className={lbl}>
                Email
                <input name="email" type="email" required className={input} autoComplete="off" />
              </label>
            </div>
            <RoleChecks selected={["reviewer"]} />
            <label className={`${lbl} mt-6 block`}>
              Temporary password (share it privately; they must change it)
              <input name="temporaryPassword" type="password" autoComplete="new-password" minLength={8} required className={input} />
            </label>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
