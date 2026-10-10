import "server-only";
import { z } from "zod";

// Validated once per process. Only variables the code actually reads are listed.
// Secrets here never carry the NEXT_PUBLIC_ prefix (scripts/check-public-env.mjs).
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  APP_BASE_URL: z.url().default("http://localhost:3200"),
  SECURITY_CONTACT: optional.pipe(z.union([z.email(), z.url(), z.undefined()])),
  /** aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/<database>. Unset: the record is shown as unavailable. */
  ALETHEIADB_URL: optional.pipe(
    z.union([z.string().startsWith("aletheiadb://", "ALETHEIADB_URL must be an aletheiadb:// connection string"), z.undefined()]),
  ),
  /** At least 32 random characters. Encrypts workbench session cookies. */
  AUTH_SECRET: optional.pipe(z.union([z.string().min(32, "AUTH_SECRET must be at least 32 characters"), z.undefined()])),
  /** Shared secret for scheduled jobs (Vercel Cron sends it as a Bearer token). */
  CRON_SECRET: optional.pipe(z.union([z.string().min(32, "CRON_SECRET must be at least 32 characters"), z.undefined()])),
  /** 32 random bytes, base64. Wraps the per-person keys that encrypt personal data (brief §8.4). */
  DATA_ENCRYPTION_MASTER_KEY: optional.pipe(
    z.union([
      z.string().refine((v) => Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_MASTER_KEY must be 32 bytes, base64-encoded"),
      z.undefined(),
    ]),
  ),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`);
  }
  if (parsed.data.APP_ENV === "production" && parsed.data.ALETHEIADB_URL && !parsed.data.DATA_ENCRYPTION_MASTER_KEY) {
    throw new Error("Invalid environment: DATA_ENCRYPTION_MASTER_KEY is required in production when ALETHEIADB_URL is set");
  }
  cached = parsed.data;
  return cached;
}
