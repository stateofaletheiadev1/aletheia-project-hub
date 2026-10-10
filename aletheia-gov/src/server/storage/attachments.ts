import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { AletheiaDB } from "@aletheia/aletheiadb";
import { openBytes, sealBytes, type Sealed } from "@/server/crypto/envelope";

// Confidential attachments (CVs) stored in AletheiaDB itself (brief §8.4, §12.3): split into
// 128 KiB chunks, each encrypted under the owner's subject key with its position bound in.
// A document is capped at 256 KB, so a 2 MB CV is at most 16 chunk documents.

const CHUNK = 128 * 1024;

export type AttachmentMeta = { fileId: string; name: string; contentType: string; size: number; sha256: string; chunks: number; uploadedAt: string };

type Chunk = { fileId: string; subject: string; index: number; total: number; data: Sealed };

export async function storeAttachment(
  db: AletheiaDB,
  subject: string,
  key: Buffer,
  file: { bytes: Uint8Array; name: string; contentType: string },
): Promise<AttachmentMeta> {
  const fileId = randomUUID().replace(/-/g, "");
  const total = Math.ceil(file.bytes.length / CHUNK);
  const chunks = db.collection<Chunk>("attachments");
  for (let index = 0; index < total; index++) {
    const part = file.bytes.subarray(index * CHUNK, (index + 1) * CHUNK);
    await chunks.insertOne(
      { fileId, subject, index, total, data: sealBytes(key, Buffer.from(part), `attachment:${fileId}:${index}`) },
      { idempotencyKey: `attachment-${fileId}-${index}` },
    );
  }
  return {
    fileId,
    name: file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "cv.pdf",
    contentType: file.contentType,
    size: file.bytes.length,
    sha256: createHash("sha256").update(file.bytes).digest("hex"),
    chunks: total,
    uploadedAt: new Date().toISOString(),
  };
}

/** Reassembles and decrypts an attachment; verifies length and SHA-256 against its metadata. */
export async function readAttachment(db: AletheiaDB, key: Buffer, meta: AttachmentMeta): Promise<Buffer> {
  const { documents } = await db.collection<Chunk>("attachments").find({ fileId: meta.fileId }, { sort: { index: 1 }, limit: 100 });
  if (documents.length !== meta.chunks) throw new Error("attachment is incomplete");
  const bytes = Buffer.concat(documents.map((c) => openBytes(key, c.data, `attachment:${meta.fileId}:${c.index}`)));
  if (bytes.length !== meta.size || createHash("sha256").update(bytes).digest("hex") !== meta.sha256) throw new Error("attachment failed its integrity check");
  return bytes;
}

export async function deleteAttachment(db: AletheiaDB, fileId: string): Promise<void> {
  const chunks = db.collection<Chunk>("attachments");
  const { documents } = await chunks.find({ fileId }, { limit: 100 });
  for (const c of documents) await chunks.deleteOne(c._id, c._rev);
}
