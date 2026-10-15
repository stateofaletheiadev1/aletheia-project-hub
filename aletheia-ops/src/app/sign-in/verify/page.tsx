import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/frame/AuthShell";
import { mfaToken } from "@/server/session";
import { CodeForm } from "../forms";

export const metadata: Metadata = { title: "Authenticator code" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await mfaToken())) redirect("/sign-in");
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Enter your code"
      lede="Open your authenticator app and enter the code shown for Aletheia Operations. The code changes every 30 seconds."
      footer={
        <Link href="/sign-in" className="underline underline-offset-4 hover:text-ink-inverse">
          Start again
        </Link>
      }
    >
      <CodeForm next={next ?? "/"} />
    </AuthShell>
  );
}
