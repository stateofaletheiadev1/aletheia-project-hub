import { env } from "@/lib/config/env";
import { site } from "@/lib/site";

// Served only when a real security contact is configured (brief §14).
export const dynamic = "force-dynamic";

export function GET() {
  const contact = env().SECURITY_CONTACT;
  if (!contact) return new Response("Not found", { status: 404 });
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const value = contact.includes("@") && !contact.startsWith("http") ? `mailto:${contact}` : contact;
  const body = `Contact: ${value}\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${site.url}/.well-known/security.txt\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
