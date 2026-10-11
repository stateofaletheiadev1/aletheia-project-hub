import "server-only";
import { AletheiaDB } from "@aletheia/aletheiadb";
import { env } from "@/lib/config/env";

// The only module that talks to AletheiaDB (brief §8.2). Everything else goes through
// server/records or server/services. Returns null when no database is configured, so
// callers can show an honest "not connected" state instead of failing.

let client: AletheiaDB | null | undefined;

export function database(): AletheiaDB | null {
  if (client !== undefined) return client;
  const url = env().ALETHEIADB_URL;
  client = url ? AletheiaDB.connect(url, { retries: 1 }) : null;
  return client;
}

