// The publication gateway (brief §31). Two adapters: the portal (signed requests to
// aletheiagov.org, ADR 0003) and a development adapter that simulates confirmation and says so.

import type { Content } from "@/domain/content";
import type { Register } from "@/domain/registers";

/** What is sent to the portal: exactly what the public record will show, and its hash. */
export type PublicationPayload = {
  register: Register;
  reference: string;
  slug: string;
  workbenchRecordId: string;
  version: number;
  versionHash: string;
  title: string;
  summary: string;
  body: Content["body"];
  facts: Content["facts"];
  institution: string;
  contentHash: string;
};

/** Taking a record off the public record (ADR 0010). */
export type WithdrawalPayload = { register: Register; reference: string; workbenchRecordId: string; reason: string };

export type PublicationOutcome =
  | { kind: "confirmed"; reference: string; url: string; publishedAt: string; contentHash: string; simulated: boolean }
  | { kind: "rejected"; reason: string }
  /** No clear answer (timeout, network failure, 5xx): reconcile before retrying (brief §31.4.6). */
  | { kind: "unknown"; reason: string };

export interface PublicationGateway {
  readonly simulated: boolean;
  publish(payload: PublicationPayload, idempotencyKey: string): Promise<PublicationOutcome>;
  withdraw(withdrawal: WithdrawalPayload, idempotencyKey: string): Promise<PublicationOutcome>;
  /** The authoritative state of an earlier request, by its idempotency key. */
  lookup(idempotencyKey: string): Promise<PublicationOutcome | { kind: "absent" }>;
}
