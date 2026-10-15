// One-off (ADR 0009): gives the founding administrators created before 16 October 2026 the
// Founder role, as new founders now receive at bootstrap, in place of the separate administrator
// and author roles they held. Recorded in the audit register on the owner's instruction.
// Safe to run again.
//
//   node --env-file=.env.production.local --import ./scripts/lib/register.mjs scripts/founders-grants.ts
import { randomUUID } from "node:crypto";
import { AletheiaDBStore } from "@/adapters/aletheiadb/aletheiadb-store";
import { parseEnv } from "@/lib/env";
import { commitAudited } from "@/services/audit";
import { FOUNDER_GRANTS } from "@/services/identity/identity";
import type { Official } from "@/services/identity/types";

const e = parseEnv(process.env);
if (!e.ALETHEIADB_URL) throw new Error("ALETHEIADB_URL is not set");
const store = new AletheiaDBStore(e.ALETHEIADB_URL);
const uow = { store, now: () => new Date(), correlationId: randomUUID() };

const founders = (await store.find<Official>("officials", {}, { limit: 1000 })).documents.filter(
  (o) => o.invitedBy === null && o.grants.some((g) => g.role === "system_administrator" || g.role === "founder"),
);
console.log(`${founders.length} founding administrators found`);
for (const o of founders) {
  if (o.grants.some((g) => g.role === "founder" && g.institution === "*")) {
    console.log(`${o.name}: already a founder`);
    continue;
  }
  await commitAudited(
    uow,
    [{ op: "update", collection: "officials", id: o._id, expectedRev: o._rev, update: { $set: { grants: FOUNDER_GRANTS } } }],
    [
      {
        actorId: null,
        action: "role.grant",
        target: { type: "official", id: o.id },
        reason: "Founding grant on the owner's instruction (ADR 0009): founders hold every power.",
        details: { role: "founder", institution: "*", clearance: "confidential" },
      },
    ],
  );
  console.log(`${o.name}: now Founder (every power, every institution)`);
}
