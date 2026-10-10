import { currentUser } from "@/server/auth/current-user";
import { can } from "@/server/authorization/policies";
import { audit } from "@/server/services/audit";
import { readCv } from "@/server/services/interest";

// CV download (brief §10.6): authorised route, attachment disposition, nosniff, sandboxed,
// never cached, every download audited. Anything not visible to the caller is a plain 404.
export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: RouteContext<"/workbench/interest/[reference]/cv/[fileId]">) {
  const user = await currentUser();
  if (!user || user.mustChangePassword || !can({ id: user.id, roles: user.roles }, "cv.download")) return notFound();
  const { reference, fileId } = await ctx.params;
  if (!/^AGV-EOI-\d{4}-\d{4,}$/.test(reference) || !/^[0-9a-f]{32}$/.test(fileId)) return notFound();

  const bytes = await readCv(reference, fileId);
  if (!bytes) return notFound();
  // ?view=1: fetched by the in-page preview (drawn by pdf.js), recorded separately from downloads.
  const preview = new URL(req.url).searchParams.get("view") === "1";
  await audit({ actorId: user.id, action: preview ? "cv.preview" : "cv.download", target: { type: "interest", id: reference }, outcome: "success", details: { fileId } });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${reference}-cv.pdf"`,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
