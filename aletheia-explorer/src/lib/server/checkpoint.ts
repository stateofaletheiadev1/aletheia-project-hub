// The transaction count from genesis up to a finalized height, kept on disk. Finalized blocks
// never change, so the count stays true forever and a restart only counts the blocks after it.
// Before this, every restart re-read the whole chain (4.2 million blocks on Mainnet Beta,
// hours of load on a 1 vCPU host shared with the node, 2026-11-27).
//
// The file lives in systemd's StateDirectory (STATE_DIRECTORY, /var/lib/aletheia-explorer).
// Without one (development) nothing is kept and the count starts from the chain as before.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";

export type Checkpoint = {
  /** Chain this count belongs to; a different chain ignores it. */
  readonly chainId: number;
  /** Transactions in heights 0..=height. */
  readonly height: number;
  readonly txs: number;
};

function path(): string | null {
  // systemd may list several directories, separated like PATH (":" on Linux, ";" on Windows).
  const dir = process.env.STATE_DIRECTORY?.split(delimiter)[0];
  return dir ? join(dir, "count.json") : null;
}

export async function loadCheckpoint(chainId: number): Promise<Checkpoint | null> {
  const file = path();
  if (!file) return null;
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as Partial<Checkpoint>;
    const ok =
      value.chainId === chainId &&
      Number.isSafeInteger(value.height) &&
      Number.isSafeInteger(value.txs) &&
      (value.height ?? -1) >= 0 &&
      (value.txs ?? -1) >= 0;
    return ok ? (value as Checkpoint) : null;
  } catch {
    return null;
  }
}

/** Written to a temporary file and renamed, so a crash never leaves a half-written count. */
export async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const file = path();
  if (!file) return;
  try {
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(checkpoint));
    await rename(`${file}.tmp`, file);
  } catch (error) {
    console.error(`explorer: cannot save the transaction count: ${(error as Error).message}`);
  }
}
