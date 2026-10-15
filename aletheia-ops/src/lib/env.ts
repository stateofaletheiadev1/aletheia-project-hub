import "server-only";
import { z } from "zod";

// Server environment, validated once per process. Documented in .env.example. Secrets never
// carry the NEXT_PUBLIC_ prefix and never reach the browser.

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const base64Key = (name: string) =>
  optional.pipe(z.union([z.string().refine((v) => Buffer.from(v, "base64").length === 32, `${name} must be 32 bytes, base64-encoded`), z.undefined()]));

const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_BASE_URL: z.url().default("http://localhost:3300"),
  BUILD_ID: z.string().default("local"),
  /** aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/workbench (readWrite). */
  ALETHEIADB_URL: optional.pipe(z.union([z.string().startsWith("aletheiadb://", "ALETHEIADB_URL must be an aletheiadb:// connection string"), z.undefined()])),
  /** Seals TOTP secrets and other small secrets at rest (ADR 0004). */
  DATA_ENCRYPTION_KEY: base64Key("DATA_ENCRYPTION_KEY"),
  /** Keys the hash used to find accounts by email without storing it in clear. */
  EMAIL_INDEX_KEY: base64Key("EMAIL_INDEX_KEY"),
  /** "portal" publishes to aletheiagov.org; "development" simulates it (brief §31.6). */
  PUBLICATION_MODE: z.enum(["portal", "development"]).default("development"),
  PORTAL_BASE_URL: z.url().default("https://www.aletheiagov.org"),
  PORTAL_HMAC_KEY_ID: optional,
  PORTAL_HMAC_SECRET: optional.pipe(z.union([z.string().min(32, "PORTAL_HMAC_SECRET must be at least 32 characters"), z.undefined()])),
  CRON_SECRET: optional.pipe(z.union([z.string().min(32, "CRON_SECRET must be at least 32 characters"), z.undefined()])),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const e = parsed.data;
  if (e.APP_ENV === "production") {
    // Brief §31.6: the production build refuses to start with simulated publication.
    if (e.PUBLICATION_MODE !== "portal") throw new Error("Invalid environment: PUBLICATION_MODE must be 'portal' in production");
    const missing = (["ALETHEIADB_URL", "DATA_ENCRYPTION_KEY", "EMAIL_INDEX_KEY", "PORTAL_HMAC_KEY_ID", "PORTAL_HMAC_SECRET", "CRON_SECRET"] as const).filter((k) => !e[k]);
    if (missing.length) throw new Error(`Invalid environment: required in production: ${missing.join(", ")}`);
  }
  if (e.PUBLICATION_MODE === "portal" && (!e.PORTAL_HMAC_KEY_ID || !e.PORTAL_HMAC_SECRET)) {
    throw new Error("Invalid environment: PUBLICATION_MODE=portal needs PORTAL_HMAC_KEY_ID and PORTAL_HMAC_SECRET");
  }
  return e;
}

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
