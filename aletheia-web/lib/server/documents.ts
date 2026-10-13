import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { randomUUID } from 'node:crypto';
import { collection } from './db';
import { sha256 } from './crypto';
import { ERASED, openBytes, openFields, sealBytes, sealFields, type Sealed } from './envelope';
import { fail } from './http';
import { accountPii, accounts, type StoredAccount } from './accounts';
import type { StoredOfficer } from './officers';
import { audit, nextReference, notify } from './records';

// Documents: those the State issues (certificates, rendered as PDFs from the registry record)
// and those people submit for review. Submitted files are encrypted under the holder's key and
// stored in AletheiaDB in chunks (a document holds at most 256 KB). The SHA-256 of the
// original file is kept so every download is checked against it.

export type IssuedKind = 'e-residence-certificate' | 'company-charter' | 'tax-residency' | 'apostille' | 'digital-credential';
export const SUBMITTED_TYPES = ['Biometric Passport Scan', 'Articles of Association', 'Apostille Certificate', 'Police Clearance', 'Proof of Address', 'Other Supporting Document'] as const;
export type SubmittedType = (typeof SUBMITTED_TYPES)[number];
export type DocumentStatus = 'Verified' | 'Pending Review' | 'Flagged';

export type DocumentRecord = {
  reference: string;
  accountId: string;
  subject: string;
  /** { name, holder, reviewNote } sealed under the holder's key. */
  sealed: Sealed;
  direction: 'issued' | 'submitted';
  kind: IssuedKind | null;
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
};
type DocPii = { name: string; holder: string; reviewNote: string | null };

type Chunk = { fileId: string; index: number; sealed: Sealed };

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
};
const CHUNK_BYTES = 150 * 1024;

export const documents = () => collection<DocumentRecord>('documents');
const chunks = () => collection<Chunk>('file_chunks');
const docPii = (d: Pick<DocumentRecord, 'subject' | 'sealed'>) => openFields<DocPii>(d.subject, d.sealed, 'documents', { name: ERASED, holder: ERASED, reviewNote: null });

export async function issueDocument(input: { accountId: string; kind: IssuedKind; name: string; docType: string; authority: string; relatedId: string }): Promise<Doc<DocumentRecord>> {
  const account = (await accounts().findById(input.accountId))!;
  const holder = (await accountPii(account)).name;
  const reference = await nextReference('DOC');
  const createdAt = new Date().toISOString();
  return documents().insertOne({
    reference,
    accountId: input.accountId,
    subject: account.subject,
    sealed: await sealFields(account.subject, { name: input.name, holder, reviewNote: null } satisfies DocPii, 'documents'),
    direction: 'issued',
    kind: input.kind,
    docType: input.docType,
    authority: input.authority,
    hash: sha256(JSON.stringify({ reference, ...input, holder, createdAt })),
    size: 0,
    contentType: 'application/pdf',
    fileId: null,
    relatedId: input.relatedId,
    status: 'Verified',
    createdAt,
    reviewedBy: null,
    reviewedAt: null,
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
    await chunks().insertOne({ fileId, index, sealed: await sealBytes(account.subject, file.bytes.subarray(i, i + CHUNK_BYTES), `file:${fileId}:${index}`) });
  }
  const holder = (await accountPii(account)).name;
  const doc = await documents().insertOne({
    reference: await nextReference('DOC'),
    accountId: account._id,
    subject: account.subject,
    sealed: await sealFields(account.subject, { name: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document', holder, reviewNote: null } satisfies DocPii, 'documents'),
    direction: 'submitted',
    kind: null,
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
  });
  await audit({ category: 'Documents', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Submitted ${docType} ${doc.reference} for review` });
  return doc;
}

export async function readFile(doc: DocumentRecord): Promise<{ bytes: Buffer; name: string }> {
  if (!doc.fileId) return fail(404, 'This document has no stored file.');
  const { documents: parts } = await chunks().find({ fileId: doc.fileId }, { sort: { index: 1 }, limit: 1000 });
  const opened = await Promise.all(parts.map((p) => openBytes(doc.subject, p.sealed, `file:${doc.fileId}:${p.index}`)));
  if (opened.some((b) => b === null)) return fail(410, 'This document has been erased.');
  const bytes = Buffer.concat(opened as Buffer[]);
  if (sha256(bytes) !== doc.hash) {
    console.error(`[documents] ${doc.reference}: stored file does not match its hash`);
    return fail(500, 'The stored file failed its integrity check.');
  }
  return { bytes, name: (await docPii(doc)).name };
}

export async function reviewDocument(id: string, decision: 'verify' | 'flag', note: string, officer: StoredOfficer): Promise<Doc<DocumentRecord>> {
  const d = await documents().findById(id);
  if (!d || d.direction !== 'submitted') return fail(404, 'No such submitted document.');
  const pii = await docPii(d);
  const updated = await documents().updateOne(d._id, d._rev, {
    $set: {
      status: decision === 'verify' ? 'Verified' : 'Flagged',
      reviewedBy: officer.officerId,
      reviewedAt: new Date().toISOString(),
      sealed: await sealFields(d.subject, { ...pii, reviewNote: note || null }, 'documents'),
    },
  });
  await notify({
    accountId: d.accountId,
    title: decision === 'verify' ? 'Document verified' : 'Document needs attention',
    message: decision === 'verify' ? `Your ${d.docType} (${pii.name}) has been verified.` : `Your ${d.docType} (${pii.name}) could not be accepted.${note ? ` Reason: ${note}` : ''} Please upload a new copy.`,
    category: 'Identity',
    linkText: 'Open document vault',
    linkHref: '/portal/documents',
  });
  await audit({ category: 'Documents', actor: officer.officerId, actorId: officer._id, subjectAccountId: d.accountId, action: `${decision === 'verify' ? 'Verified' : 'Flagged'} ${d.docType} ${d.reference}` });
  return updated;
}

/** Know-your-customer state of an applicant, from the documents they submitted. */
export async function kycStatus(accountId: string): Promise<{ status: 'Verified' | 'Pending Verification' | 'Manual Inspection'; count: number }> {
  const { documents: submitted } = await documents().find({ accountId, direction: 'submitted' }, { limit: 200 });
  const status = submitted.some((d) => d.status === 'Flagged') ? 'Manual Inspection' : submitted.length > 0 && submitted.every((d) => d.status === 'Verified') ? 'Verified' : 'Pending Verification';
  return { status, count: submitted.length };
}

export async function documentView(d: Doc<DocumentRecord>) {
  const pii = await docPii(d);
  return {
    id: d._id,
    reference: d.reference,
    direction: d.direction,
    kind: d.kind,
    name: pii.name,
    type: d.docType,
    holder: pii.holder,
    authority: d.authority,
    hash: d.hash,
    size: d.size,
    contentType: d.contentType,
    hasFile: Boolean(d.fileId),
    status: d.status,
    createdAt: d.createdAt,
    reviewNote: pii.reviewNote,
    relatedId: d.relatedId,
  };
}
