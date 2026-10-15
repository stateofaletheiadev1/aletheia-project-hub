// Workflow model (brief §20). Definitions are data, versioned; the engine (engine.ts) is a pure
// function from (definition, record facts, actor, action) to a decision. Nothing here performs
// I/O: services turn a decision's effects into one atomic commit (ADR 0002).

import type { Classification, RecordState } from "@/domain/glossary";
import type { Register } from "@/domain/registers";
import type { Actor, Permission } from "@/policy/roles";

export const ACTIONS = [
  "submit",
  "take_for_review",
  "request_revision",
  "reject",
  "adopt",
  "verify",
  "approve",
  "authorise_publication",
  "publish",
  "confirm_publication",
  "fail_publication",
  "retry_publication",
  "start_correction",
  "withdraw",
  "archive",
  "reopen",
] as const;
export type Action = (typeof ACTIONS)[number];

/** Button labels: verb + object (brief §15). `{noun}` is replaced by the register noun. */
export const ACTION_LABEL: Record<Action, string> = {
  submit: "Submit for review",
  take_for_review: "Take for review",
  request_revision: "Request revision",
  reject: "Reject {noun}",
  adopt: "Record adoption",
  verify: "Verify appointment",
  approve: "Approve {noun}",
  authorise_publication: "Authorise publication",
  publish: "Publish to the public record",
  confirm_publication: "Confirm publication",
  fail_publication: "Record publication failure",
  retry_publication: "Retry publication",
  start_correction: "Start a correction",
  withdraw: "Withdraw {noun}",
  archive: "Archive {noun}",
  reopen: "Reopen {noun}",
};

/** Named guards. Each one either passes or yields a sentence saying why not. */
export const GUARDS = [
  "actor_is_author",
  "actor_did_not_author_version",
  "actor_has_not_approved_version",
  "actor_did_not_approve_version",
  "actor_is_second_officer",
  "approvals_complete",
  "approvals_outstanding",
  "classification_is_public",
  "attachments_scanned",
  "source_document_linked",
  "disclosure_authorised",
  "reason_given",
  "system_only",
] as const;
export type Guard = (typeof GUARDS)[number];

/** What a transition causes, beyond the state change and its event (always written). */
export type Effect =
  | "record_approval"
  | "issue_reference"
  | "enqueue_publication"
  | "store_receipt"
  | "assign_reviewer_task"
  | "assign_author_task"
  | "assign_approver_task"
  | "assign_publisher_task"
  | "close_tasks"
  | "notify_author"
  | "notify_publishers";

export type Transition = {
  action: Action;
  from: readonly RecordState[];
  to: RecordState;
  /** Permission checked in the record's institution at the record's classification. */
  permission: Permission | null;
  guards: readonly Guard[];
  effects: readonly Effect[];
};

export type WorkflowDefinition = {
  id: string;
  register: Register;
  version: number;
  /** The path shown in the stepper, in order. */
  stages: readonly RecordState[];
  transitions: readonly Transition[];
  /** Distinct approvals needed on the current version before it is approved. */
  requiredApprovals: number;
  /** Separation of duties (brief §22). */
  sod: { authorMayNotApprove: true; approverMayNotPublish: boolean };
  /** Days allowed in each waiting state before it counts as overdue. */
  dueDays: Partial<Record<RecordState, number>>;
};

/** What the engine needs to know about a record. Assembled by services from storage. */
export type RecordFacts = {
  state: RecordState;
  institution: string;
  classification: Classification;
  /** Officials who wrote or materially edited the current version. */
  versionAuthors: readonly string[];
  /** The author of the record (first version). */
  authorId: string;
  /** Approvals bound to the current version's content hash. */
  approvals: readonly { officialId: string; versionHash: string }[];
  currentVersionHash: string;
  /** The first officer: who recorded adoption (decisions) or verification (appointments). */
  endorsedBy?: string;
  attachmentsUnscanned: number;
  sourceDocument?: string;
  disclosureAuthorised?: boolean;
};

export type Attempt = {
  action: Action;
  actor: Actor | "system";
  reason?: string;
};

export type Decision =
  | { ok: true; transition: Transition; from: RecordState; to: RecordState; effects: readonly Effect[] }
  | { ok: false; code: "unknown_action" | "wrong_state" | "forbidden" | "guard"; reasons: string[] };
