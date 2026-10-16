import { downloadCv } from "@/services/applications/applications";
import { applications, requireDeps } from "@/server/runtime";
import { currentOfficial } from "@/server/session";

// An applicant's CV, fetched from aletheiagov.org for an official allowed to read applications
// (ADR 0011). Attachment disposition, nosniff, sandboxed, never cached, every download audited
// here and on the portal. Anything not visible to the caller is a plain 404.

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string; fileId: string }> }) {
  const signedIn = await currentOfficial();
  const gw = applications();
  if (!signedIn || !gw) return notFound();
  const { reference, fileId } = await params;
  if (!/^AGV-EOI-\d{4}-\d{4,}$/.test(reference) || !/^[0-9a-f]{32}$/.test(fileId)) return notFound();
  const bytes = await downloadCv(await requireDeps(), gw, signedIn.actor, reference, fileId);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reference}-cv.pdf"`,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
