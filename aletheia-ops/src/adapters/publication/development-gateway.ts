// The development publication adapter (brief §31.6). Used only with PUBLICATION_MODE=development,
// which a production environment refuses (lib/env.ts). It "confirms" every publication with a
// receipt marked simulated; nothing reaches aletheiagov.org. A banner says so on every page.

import { REGISTER } from "@/domain/registers";
import type { PublicationGateway, PublicationOutcome, PublicationPayload, WithdrawalPayload } from "@/ports/publication";

export class DevelopmentGateway implements PublicationGateway {
  readonly simulated = true;
  private readonly seen = new Map<string, PublicationOutcome>();

  private readonly portalBase: string;

  constructor(portalBase: string) {
    this.portalBase = portalBase;
  }

  async publish(payload: PublicationPayload, idempotencyKey: string): Promise<PublicationOutcome> {
    const prior = this.seen.get(idempotencyKey);
    if (prior) return prior;
    const outcome: PublicationOutcome = {
      kind: "confirmed",
      reference: payload.reference,
      url: `${this.portalBase}${REGISTER[payload.register].publicPath}/${payload.slug}`,
      publishedAt: new Date().toISOString(),
      contentHash: payload.contentHash,
      simulated: true,
    };
    this.seen.set(idempotencyKey, outcome);
    return outcome;
  }

  async withdraw(w: WithdrawalPayload, idempotencyKey: string): Promise<PublicationOutcome> {
    const prior = this.seen.get(idempotencyKey);
    if (prior) return prior;
    const outcome: PublicationOutcome = { kind: "confirmed", reference: w.reference, url: `${this.portalBase}${REGISTER[w.register].publicPath}/${w.reference.toLowerCase()}`, publishedAt: new Date().toISOString(), contentHash: "", simulated: true };
    this.seen.set(idempotencyKey, outcome);
    return outcome;
  }

  async lookup(idempotencyKey: string) {
    return this.seen.get(idempotencyKey) ?? { kind: "absent" as const };
  }
}
