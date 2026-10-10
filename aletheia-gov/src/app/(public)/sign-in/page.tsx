import type { Metadata } from "next";
import Link from "next/link";
import { Contours } from "@/components/brand/Contours";
import { Mark } from "@/components/brand/Mark";
import { SignInForm } from "@/features/auth/SignInForm";
import { sessionsConfigured } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Government Workbench.",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const q = await props.searchParams;
  const nextParam = typeof q.next === "string" && q.next.startsWith("/workbench") ? q.next : "/workbench";
  const signedOut = q["signed-out"] === "1";
  const open = sessionsConfigured();

  return (
    <section className="sea relative flex min-h-[88vh] items-center overflow-hidden">
      <Contours variant="b" opacity={0.07} eager />
      <div className="shell relative grid-12 gap-y-12 pb-24 pt-[calc(var(--header-h)+5rem)]">
        <div className="col-span-12 md:col-span-6 lg:col-span-5">
          <Mark size={40} />
          <h1 id="page-title" tabIndex={-1} className="t-h1 mt-10 text-parchment-50 outline-none">
            Sign in
          </h1>
          <p className="t-lede mt-5 text-parchment-300">The Government Workbench, for officers of the founding government.</p>
          {signedOut ? (
            <p role="status" className="mt-6 text-[0.9375rem] text-green-300">
              You are signed out.
            </p>
          ) : null}
          <div className="mt-10">
            {open ? (
              <SignInForm next={nextParam} />
            ) : (
              <p className="max-w-[46ch] text-[1.0625rem] text-parchment-300">Sign-in is not available on this site yet.</p>
            )}
          </div>
        </div>
        <div className="col-span-12 md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9 md:self-end">
          <div className="border-t border-[var(--rule-sea)] pt-6 text-[0.9375rem] leading-relaxed text-parchment-300">
            <p className="font-semibold text-parchment-50">Not an officer?</p>
            <p className="mt-2">
              You do not need an account to take part. Register your interest on any institution&apos;s page, or on{" "}
              <Link href="/build-aletheia" className="text-gold-300 underline underline-offset-4">
                Build Aletheia
              </Link>
              . Accounts are created by an administrator; there is no public sign-up.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
