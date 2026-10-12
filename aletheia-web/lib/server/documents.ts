import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { randomUUID } from 'node:crypto';
import { collection } from './db';
import { sha256 } from './crypto';
import { fail } from './http';
import type { StoredAccount } from './accounts';
import type { StoredOfficer } from './officers';
import { audit, nextReference, notify } from './records';

// Documents: those the State issues (certificates, rendered as PDFs from the registry record)
// and those people submit for review (stored in AletheiaDB in chunks; a document holds at most
// 256 KB, so a 4 MB file is about 27 chunks).

export type IssuedKind = 'e-residence-certificate' | 'company-charter' | 'tax-residency' | 'apostille' | 'digital-credential';
export const SUBMITTED_TYPES = ['Biometric Passport Scan', 'Articles of Association', 'Apostille Certificate', 'Police Clearance', 'Proof of Address', 'Other Supporting Document'] as const;
export type SubmittedType = (typeof SUBMITTED_TYPES)[number];
export type DocumentStatus = 'Verified' | 'Pending Review' | 'Flagged';

export type DocumentRecord = {
  reference: string;
  accountId: string;
  holder: string;
  direction: 'issued' | 'submitted';
  kind: IssuedKind | null;
  name: string;
  docType: string;
  authority: string | null;
  hash: string;
  size: number;
  contentType: string;
  fileId: string | null;
  relatedId: string | null;
  status: DocumentStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type Chunk = { fileId: string; index: number; data: string };

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
};
const CHUNK_BYTES = 150 * 1024;

export const documents = () => collection<DocumentRecord>('documents');
const chunks = () => collection<Chunk>('file_chunks');

export async function issueDocument(input: { accountId: string; holder: string; kind: IssuedKind; name: string; docType: string; authority: string; relatedId: string }): Promise<Doc<DocumentRecord>> {
  const reference = await nextReference('DOC');
  const createdAt = new Date().toISOString();
  return documents().insertOne({
    ...input,
    reference,
    direction: 'issued',
    hash: sha256(JSON.stringify({ reference, ...input, createdAt })),
    size: 0,
    contentType: 'application/pdf',
    fileId: null,
    status: 'Verified',
    createdAt,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  });
}

export async function uploadDocument(account: StoredAccount, file: { name: string; type: string; bytes: Buffer }, docType: SubmittedType): Promise<Doc<DocumentRecord>> {
  const magic = ALLOWED_TYPES[file.type];
  if (!magic) return fail(415, 'Upload a PDF, PNG or JPEG file.');
  if (file.bytes.length === 0) return fail(400, 'The file is empty.');
  if (file.bytes.length > MAX_UPLOAD_BYTES) return fail(413, 'The file is larger than 4 MB.');
  if (!magic.every((b, i) => file.bytes[i] === b)) return fail(415, 'The file content does not match its type.');
  const fileId = randomUUID();
  for (let i = 0, index = 0; i < file.bytes.length; i += CHUNK_BYTES, index++) {
    await chunks().insertOne({ fileId, index, data: file.bytes.subarray(i, i + CHUNK_BYTES).toString('base64') });
  }
  const doc = await documents().insertOne({
    reference: await nextReference('DOC'),
    accountId: account._id,
    holder: account.name,
    direction: 'submitted',
    kind: null,
    name: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document',
    docType,
    authority: null,
    hash: sha256(file.bytes),
    size: file.bytes.length,
    contentType: file.type,
    fileId,
    relatedId: null,
    status: 'Pending Review',
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  });
  await audit({ category: 'Documents', actor: account.name, actorId: account._id, subjectAccountId: account._id, action: `Submitted ${docType} ${doc.reference} for review` });
  return doc;
}

export async function readFile(doc: DocumentRecord): Promise<Buffer> {
  if (!doc.fileId) return fail(404, 'This document has no stored file.');
  const { documents: parts } = await chunks().find({ fileId: doc.fileId }, { sort: { index: 1 }, limit: 1000 });
  const bytes = Buffer.concat(parts.map((p) => Buffer.from(p.data, 'base64')));
  if (sha256(bytes) !== doc.hash) {
    console.error(`[documents] ${doc.reference}: stored file does not match its hash`);
    return fail(500, 'The stored file failed its integrity check.');
  }
  return bytes;
}

export async function reviewDocument(id: string, decision: 'verify' | 'flag', note: string, officer: StoredOfficer): Promise<Doc<DocumentRecord>> {
  const d = await documents().findById(id);
  if (!d || d.direction !== 'submitted') return fail(404, 'No such submitted document.');
  const updated = await documents().updateOne(d._id, d._rev, {
    $set: { status: decision === 'verify' ? 'Verified' : 'Flagged', reviewedBy: officer.officerId, reviewedAt: new Date().toISOString(), reviewNote: note || null },
  });
  await notify({
    accountId: d.accountId,
    title: decision === 'verify' ? 'Document verified' : 'Document needs attention',
    message: decision === 'verify' ? `Your ${d.docType} (${d.name}) has been verified.` : `Your ${d.docType} (${d.name}) could not be accepted.${note ? ` Reason: ${note}` : ''} Please upload a new copy.`,
    category: 'Identity',
    linkText: 'Open document vault',
    linkHref: '/portal/documents',
  });
  await audit({ category: 'Documents', actor: officer.name, actorId: officer._id, subjectAccountId: d.accountId, action: `${decision === 'verify' ? 'Verified' : 'Flagged'} ${d.docType} ${d.reference} (${d.holder})` });
  return updated;
}

/** Know-your-customer state of an applicant, from the documents they submitted. */
export async function kycStatus(accountId: string): Promise<'Verified' | 'Pending Verification' | 'Manual Inspection'> {
  const { documents: submitted } = await documents().find({ accountId, direction: 'submitted' }, { limit: 200 });
  if (submitted.some((d) => d.status === 'Flagged')) return 'Manual Inspection';
  if (submitted.length > 0 && submitted.every((d) => d.status === 'Verified')) return 'Verified';
  return 'Pending Verification';
}

export function documentView(d: Doc<DocumentRecord>) {
  return {
    id: d._id,
    reference: d.reference,
    direction: d.direction,
    kind: d.kind,
    name: d.name,
    type: d.docType,
    holder: d.holder,
    authority: d.authority,
    hash: d.hash,
    size: d.size,
    contentType: d.contentType,
    hasFile: Boolean(d.fileId),
    status: d.status,
    createdAt: d.createdAt,
    reviewNote: d.reviewNote,
    relatedId: d.relatedId,
  };
}
