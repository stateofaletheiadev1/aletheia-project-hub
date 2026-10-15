// Creates the founding administrators (at least two, so the two-person rule works from the
// start) and prints a single-use invitation link for each. Refuses once any official exists.
//
//   node --env-file=.env.local --import ./scripts/lib/register.mjs scripts/admin-bootstrap.ts \
//     "Ada Founder <ada@example.org>" "Ben Founder <ben@example.org>"
import { AletheiaDBStore } from "@/adapters/aletheiadb/aletheiadb-store";
import { parseEnv } from "@/lib/env";
import { bootstrapAdministrators } from "@/services/identity/identity";

const e = parseEnv(process.env);
if (!e.ALETHEIADB_URL || !e.DATA_ENCRYPTION_KEY || !e.EMAIL_INDEX_KEY) throw new Error("ALETHEIADB_URL, DATA_ENCRYPTION_KEY and EMAIL_INDEX_KEY must be set");

const admins = process.argv.slice(2).map((arg) => {
  const m = /^(.+?)\s*<([^>]+)>$/.exec(arg.trim());
  if (!m) throw new Error(`Write each administrator as "Full Name <email>": ${arg}`);
  return { name: m[1]!, email: m[2]! };
});

const links = await bootstrapAdministrators(
  {
    store: new AletheiaDBStore(e.ALETHEIADB_URL),
    now: () => new Date(),
    correlationId: crypto.randomUUID(),
    keys: { data: Buffer.from(e.DATA_ENCRYPTION_KEY, "base64"), index: Buffer.from(e.EMAIL_INDEX_KEY, "base64") },
  },
  admins,
);
console.log("Founding administrators created. Give each person their own link, privately. Each works once and expires in 72 hours.\n");
for (const l of links) console.log(`${l.name}\n  ${e.APP_BASE_URL}/invitation/${l.token}\n`);
