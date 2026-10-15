// Workflow definitions, version 1, one per register (brief §21). These are the initial policy;
// changes create a new version under the two-person rule, and a record keeps running on the
// version it started with.

import type { RecordState } from "@/domain/glossary";
import type { Register } from "@/domain/registers";
import type { Effect, Guard, Transition, WorkflowDefinition } from "./types";

type Options = {
  register: Register;
  /** "adopted" for decisions, "verified" for appointments: a first-officer stage before approval. */
  endorsement?: "adopted" | "verified";
  approvePermission?: Transition["permission"];
  approverMayNotPublish: boolean;
  submitGuards?: Guard[];
  authoriseGuards?: Guard[];
};

const REVIEWABLE: RecordState[] = ["submitted", "under_review", "adopted", "verified"];
const PRE_PUBLICATION: RecordState[] = [
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
  "adopted",
  "verified",
  "approved",
  "publication_authorised",
  "publication_failed",
];

function t(action: Transition["action"], from: RecordState[], to: RecordState, permission: Transition["permission"], guards: Guard[], effects: Effect[]): Transition {
  return { action, from, to, permission, guards, effects };
}

function build(o: Options): WorkflowDefinition {
  const approveFrom: RecordState[] = o.endorsement ? [o.endorsement] : ["under_review"];
  const approveGuards: Guard[] = ["actor_did_not_author_version", "actor_has_not_approved_version", ...(o.endorsement ? (["actor_is_second_officer"] as Guard[]) : [])];
  const approvePermission = o.approvePermission ?? "record.approve";
  const publishGuards: Guard[] = ["classification_is_public", "attachments_scanned", ...(o.approverMayNotPublish ? (["actor_did_not_approve_version"] as Guard[]) : [])];

  const transitions: Transition[] = [
    t("submit", ["draft", "revision_requested", "correction_in_progress"], "submitted", "record.submit", ["actor_is_author", ...(o.submitGuards ?? [])], ["assign_reviewer_task", "close_tasks"]),
    t("take_for_review", ["submitted"], "under_review", "record.review", ["actor_did_not_author_version"], ["close_tasks"]),
    t("request_revision", REVIEWABLE, "revision_requested", "record.review", ["actor_did_not_author_version", "reason_given"], ["assign_author_task", "notify_author", "close_tasks"]),
    t("reject", REVIEWABLE, "rejected", "record.review", ["actor_did_not_author_version", "reason_given"], ["notify_author", "close_tasks"]),
  ];
  if (o.endorsement === "adopted") {
    transitions.push(t("adopt", ["under_review"], "adopted", "record.adopt", ["actor_did_not_author_version"], ["assign_approver_task", "close_tasks"]));
  }
  if (o.endorsement === "verified") {
    transitions.push(t("verify", ["under_review"], "verified", "record.verify", ["actor_did_not_author_version"], ["assign_approver_task", "close_tasks"]));
  }
  transitions.push(
    // The approval that completes the set moves the record on; an earlier one is recorded and waits.
    t("approve", approveFrom, "approved", approvePermission, [...approveGuards, "approvals_complete"], ["record_approval", "assign_publisher_task", "notify_author", "close_tasks"]),
    ...approveFrom.map((s) => t("approve", [s], s, approvePermission, [...approveGuards, "approvals_outstanding"], ["record_approval"])),
    t("authorise_publication", ["approved"], "publication_authorised", "publication.authorise", [...publishGuards, ...(o.authoriseGuards ?? [])], ["issue_reference", "assign_publisher_task", "close_tasks"]),
    t("publish", ["publication_authorised"], "publishing", "publication.publish", publishGuards, ["enqueue_publication", "close_tasks"]),
    t("confirm_publication", ["publishing"], "published", null, ["system_only"], ["store_receipt", "notify_author"]),
    t("fail_publication", ["publishing"], "publication_failed", null, ["system_only"], ["notify_publishers"]),
    t("retry_publication", ["publication_failed"], "publishing", "publication.publish", publishGuards, ["enqueue_publication"]),
    t("start_correction", ["published"], "correction_in_progress", "record.edit", ["reason_given"], ["assign_author_task"]),
    t("withdraw", PRE_PUBLICATION, "withdrawn", "record.withdraw", ["reason_given"], ["notify_author", "close_tasks"]),
    t("archive", ["published", "rejected", "withdrawn"], "archived", "record.archive", [], ["close_tasks"]),
    t("reopen", ["rejected"], "draft", "record.approve", ["reason_given"], ["assign_author_task"]),
  );

  const stages: RecordState[] = ["draft", "submitted", "under_review", ...(o.endorsement ? [o.endorsement] : []), "approved", "publication_authorised", "publishing", "published"];

  return {
    id: `${o.register}.v1`,
    register: o.register,
    version: 1,
    stages,
    transitions,
    requiredApprovals: 1,
    sod: { authorMayNotApprove: true, approverMayNotPublish: o.approverMayNotPublish },
    dueDays: { submitted: 3, under_review: 7, adopted: 5, verified: 5, revision_requested: 7, approved: 5, publication_authorised: 2 },
  };
}

export const DEFINITIONS: Record<Register, WorkflowDefinition> = {
  documents: build({ register: "documents", approverMayNotPublish: false }),
  decisions: build({ register: "decisions", endorsement: "adopted", approverMayNotPublish: true }),
  dispatches: build({ register: "dispatches", approverMayNotPublish: false }),
  finance: build({ register: "finance", approvePermission: "finance.approve", approverMayNotPublish: true, submitGuards: ["source_document_linked"] }),
  appointments: build({ register: "appointments", endorsement: "verified", approverMayNotPublish: true, authoriseGuards: ["disclosure_authorised"] }),
  opportunities: build({ register: "opportunities", approverMayNotPublish: false }),
  events: build({ register: "events", approverMayNotPublish: false }),
};

/** All definitions ever issued, by id, so records keep running on the version they started with. */
const ALL: Record<string, WorkflowDefinition> = Object.fromEntries(Object.values(DEFINITIONS).map((d) => [d.id, d]));

export function definitionById(id: string): WorkflowDefinition | undefined {
  return ALL[id];
}
