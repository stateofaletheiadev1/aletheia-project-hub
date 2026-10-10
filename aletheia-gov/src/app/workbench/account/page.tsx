import { WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { signOutAll } from "@/features/auth/actions";
import { PasswordForm } from "@/features/auth/PasswordForm";
import { requireUser } from "@/server/auth/current-user";
import { ROLE_LABEL } from "@/server/authorization/policies";

export const metadata = { title: "Account and security" };


export default async function Account() {
  const user = await requireUser({ allowPasswordChange: true });
  const startedAt = new Date(user.session.iat * 1000);

  return (
    <>
      <WorkbenchHeading eyebrow="Account and security" title={user.name}>
        {user.email} · {user.roles.map((r) => ROLE_LABEL[r]).join(" · ")}
      </WorkbenchHeading>

      {user.mustChangePassword ? (
        <p role="alert" className="mb-10 max-w-2xl border-l-2 border-[#8a5a00] bg-parchment-100 px-5 py-4 text-[0.9375rem]">
          <strong className="font-semibold">Choose your own password to continue.</strong> Your current password was set by an administrator. Until you change it, the
          rest of the workbench stays locked.
        </p>
      ) : null}

      <div className="grid max-w-5xl gap-14 lg:grid-cols-2">
        <section aria-labelledby="pw">
          <h2 id="pw" className="t-h3">
            Change password
          </h2>
          <p className="mt-2 text-[0.875rem] text-ink-600">Changing it signs out your other sessions.</p>
          <PasswordForm email={user.email} />
        </section>

        <section aria-labelledby="sessions">
          <h2 id="sessions" className="t-h3">
            Sessions
          </h2>
          <p className="mt-2 text-[0.875rem] text-ink-600">
            This session started {startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC. Sessions end after 30 minutes without activity and after 12 hours in any case.
          </p>
          <form action={signOutAll} className="mt-5">
            <button type="submit" className="min-h-10 border border-[#9b2c2c] px-4 text-[0.875rem] font-semibold text-[#9b2c2c] hover:bg-[#9b2c2c] hover:text-parchment-50">
              Sign out everywhere
            </button>
          </form>

          <h2 className="t-h3 mt-12">Two-factor sign-in</h2>
          <p className="mt-2 text-[0.875rem] text-ink-600">Not enabled yet. An authenticator-app code will be added to sign-in before the workbench is used with real records.</p>
        </section>
      </div>
    </>
  );
}
