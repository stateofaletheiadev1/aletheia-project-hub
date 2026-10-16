import { WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { signOutAll, startTwoStepSetup } from "@/features/auth/actions";
import { PasswordForm } from "@/features/auth/PasswordForm";
import { TurnOffTwoStepForm } from "@/features/auth/TwoStepForms";
import { requireUser } from "@/server/auth/current-user";
import { ROLE_LABEL } from "@/server/authorization/policies";

export const metadata = { title: "Account and security" };


export default async function Account(props: PageProps<"/workbench/account">) {
  const user = await requireUser({ allowPasswordChange: true });
  const justOn = (await props.searchParams)["two-step"] === "on";
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

          <h2 id="two-step" className="t-h3 mt-12">
            Two-step sign-in
          </h2>
          {justOn ? (
            <p role="status" className="mt-3 border-l-2 border-[#2f6b3f] bg-[#eaf4ec] px-4 py-3 text-[0.9375rem] text-[#1f4d2b]">
              <strong className="font-semibold">Two-step sign-in is on.</strong> From now on you sign in with your password and the code from your app. Every other session was signed out.
            </p>
          ) : null}
          {user.twoStep ? (
            <>
              <p className="mt-2 text-[0.875rem] text-ink-600">
                <span className="font-semibold text-[#2f6b3f]">On.</span> Every sign-in asks for your password and a six-digit code from your authenticator app. You can turn it off at any time.
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.875rem] font-semibold text-[#9b2c2c]">Turn two-step sign-in off</summary>
                <TurnOffTwoStepForm />
              </details>
            </>
          ) : (
            <>
              <p className="mt-2 text-[0.875rem] text-ink-600">
                <span className="font-semibold">Off.</span> You sign in with your password only. It is your choice: you can turn on two-step sign-in at any time, so that a code from an
                authenticator app on your phone is also needed and a stolen password is not enough. You can turn it off again whenever you wish.
              </p>
              <form action={startTwoStepSetup} className="mt-4">
                <button type="submit" className="min-h-10 bg-navy-800 px-5 text-[0.875rem] font-semibold text-parchment-50 hover:bg-navy-900">
                  Turn on two-step sign-in
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
