import "server-only";
import { ConflictError, type AletheiaDB } from "@aletheia/aletheiadb";
import { formatReference, type ReferenceType } from "@/lib/references";

// Issues official references AGV-{TYPE}-{YEAR}-{SEQ} (brief §6.5.1): unique, gap-tolerant,
// never reused. Each (type, year) has a counter document; increments use AletheiaDB's
// revision check, so two concurrent writers can never receive the same number.

type Counter = { name: string; value: number };

export async function nextReference(db: AletheiaDB, type: ReferenceType, year = new Date().getUTCFullYear()): Promise<string> {
  const counters = db.collection<Counter>("counters");
  const name = `ref:${type}:${year}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await counters.findOne({ name });
    try {
      if (!current) {
        await counters.insertOne({ name, value: 1 }); // unique index on `name`
        return formatReference(type, year, 1);
      }
      const next = await counters.updateOne(current._id, current._rev, { $inc: { value: 1 } });
      return formatReference(type, year, next.value);
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      // Someone else took this number first: read again and retry.
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
  throw new Error(`could not allocate a ${type} reference after several attempts`);
}
