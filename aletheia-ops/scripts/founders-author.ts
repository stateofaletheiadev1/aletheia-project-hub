// One-off (ADR 0008): gives the founding administrators created before 16 October 2026 the
// Author role in every institution, as new founders now receive at bootstrap. Recorded in the
// audit register as a founding grant on the owner's instruction. Safe to run again.
//
//   node --env-file=.env.production.local --import ./scripts/lib/register.mjs scripts/founders-author.ts
import { randomUUID } from "node:crypto";
import { AletheiaDBStore } from "@/adapters/aletheiadb/aletheiadb-store";
import { parseEnv } from "@/lib/env";
import { commitAudited } from "@/services/audit";
import type { Official } from "@/services/identity/types";

const e = parseEnv(process.env);
if (!e.ALETHEIADB_URL) throw new Error("ALETHEIADB_URL is not set");
const store = new AletheiaDBStore(e.ALETHEIADB_URL);
const uow = { store, now: () => new Date(), correlationId: randomUUID() };

const founders = (await store.find<Official>("officials", {}, { limit: 1000 })).documents.filter((o) => o.invitedBy === null && o.grants.some((g) => g.role === "system_administrator"));
console.log(`${founders.length} founding administrators found`);
for (const o of founders) {
  if (o.grants.some((g) => g.role === "author" && g.institution === "*")) {
    console.log(`${o.name}: already an author`);
    continue;
  }
  await commitAudited(
    uow,
    [{ op: "update", collection: "officials", id: o._id, expectedRev: o._rev, update: { $set: { grants: [...o.grants, { role: "author", institution: "*", clearance: "internal" }] } } }],
    [
      {
        actorId: null,
        action: "role.grant",
        target: { type: "official", id: o.id },
        reason: "Founding grant on the owner's instruction (ADR 0008): founders may author records.",
        details: { role: "author", institution: "*", clearance: "internal" },
      },
    ],
  );
  console.log(`${o.name}: Author role added in all institutions`);
}
