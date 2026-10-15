import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/frame/AuthShell";
import { isConnected } from "@/server/runtime";
import { currentOfficial } from "@/server/session";
import { SignInForm } from "./forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (!isConnected()) {
    return (
      <AuthShell title="Accounts are not open yet">
        <p className="text-ui font-normal text-ink-2">
          Access is by invitation from an administrator, with a password and an authenticator app. This installation is not yet connected to its database, so nobody can sign in.
        </p>
      </AuthShell>
    );
  }
  if (await currentOfficial()) redirect("/");
  return (
    <AuthShell title="Sign in" lede="For appointed officials of the Government of Aletheia. Access is by invitation.">
      <SignInForm next={next ?? "/"} />
    </AuthShell>
  );
}
