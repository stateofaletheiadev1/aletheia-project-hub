// Stored shapes for records (brief §18.3, §20). Versions, approvals, transitions and
// publication receipts are append-only; the record document holds the current state and the
// working copy, and its revision is the row version for optimistic concurrency.

import type { Content } from "@/domain/content";
import type { Classification, Priority, PublicationState, RecordState } from "@/domain/glossary";
import type { Register } from "@/domain/registers";
import type { PublicationPayload } from "@/ports/publication";

export type { PublicationPayload };

export type RecordDoc = {
  id: string;
  register: Register;
  institution: string;
  classification: Classification;
  priority: Priority;
  /** The workflow definition and version this record runs on (brief §20). */
  workflowId: string;
  state: RecordState;
  stateEnteredAt: string;
  /** Issued at publication authorisation; absent until then, and never changed after. */
  reference?: string;
  /** The working copy. Frozen into a version on submission. */
  draft: Content;
  /** Officials who edited the working copy since the last version. */
  draftEditors: string[];
  versionCount: number;
  currentVersion: { number: number; hash: string } | null;
  /** Officials who wrote or materially edited the current version (separation of duties). */
  versionAuthors: string[];
  authorId: string;
  /** Who recorded adoption (decisions) or verification (appointments) of the current version. */
  endorsedBy: string | null;
  attachmentsUnscanned: number;
  publication: { reference: string; url: string; publishedAt: string; contentHash: string; simulated: boolean } | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type VersionDoc = {
  id: string;
  recordId: string;
  number: number;
  hash: string;
  content: Content;
  authors: string[];
  createdAt: string;
  createdBy: string;
};

export type ApprovalDoc = { id: string; recordId: string; versionHash: string; versionNumber: number; officialId: string; at: string };

export type TransitionDoc = {
  id: string;
  recordId: string;
  workflowId: string;
  action: string;
  from: RecordState;
  to: RecordState;
  actorId: string | null;
  reason: string | null;
  versionNumber: number | null;
  versionHash: string | null;
  at: string;
  correlationId: string;
};

export type OutboxDoc = {
  id: string;
  recordId: string;
  /** Reused on every retry, so the portal can never publish twice (brief §31.4). */
  idempotencyKey: string;
  payload: PublicationPayload;
  state: PublicationState;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
};



export type ReceiptDoc = {
  id: string;
  recordId: string;
  idempotencyKey: string;
  reference: string;
  url: string;
  publishedAt: string;
  contentHash: string;
  simulated: boolean;
};
