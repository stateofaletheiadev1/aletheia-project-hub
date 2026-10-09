import "server-only";
import { z } from "zod";

// Validated once per process. Only variables the code actually reads are listed.
const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  APP_BASE_URL: z.url().default("http://localhost:3200"),
  SECURITY_CONTACT: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.union([z.email(), z.url(), z.undefined()])),
  ALETHEIADB_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}
