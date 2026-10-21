import { env } from "@/lib/config/env";
import { site } from "@/lib/site";

// The security contact: SECURITY_CONTACT when set, otherwise the published security address.
export const dynamic = "force-dynamic";

export function GET() {
  const contact = env().SECURITY_CONTACT || site.contact.security;
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const value = contact.includes("@") && !contact.startsWith("http") ? `mailto:${contact}` : contact;
  const body = `Contact: ${value}\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${site.url}/.well-known/security.txt\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
