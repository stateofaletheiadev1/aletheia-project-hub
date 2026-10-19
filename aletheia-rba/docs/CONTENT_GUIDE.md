# Content guide

Every change below is a single-file edit. All content is validated when the site builds: a missing field, a wrong date format or an unsupported status stops the build with a message that names the file and field.

Run `pnpm verify` before publishing. It includes the forbidden-claims check.

## Copy rules (brief §2.4)

- Say what is intended, not what exists: "The Bank intends to…", "is proposed to…", "has not yet been established", "will be published when…".
- Never invent policy targets, inflation targets, policy rates, issuance ceilings, money supply figures, exchange rates or reserve figures.
- Where a policy is undecided, describe the **process** that will decide it (research, consultation, adoption, publication, review), never the outcome.
- Aletheia holds no euro reserves; the Bank holds no foreign reserves; AEY has not been issued and cannot be converted. Copy must never suggest otherwise.
- Name the institution "Reserve Bank of Aletheia" and the State "Sovereign Covenant State of Aletheia". Do not call Aletheia a startup, venture, technology company or republic.
- No hype ("revolutionary", "web3" and the like).

The claims linter (`pnpm lint:claims`) rejects the phrases listed in `scripts/claims-rules.ts`. If a sentence must use one to **negate** it (for example, an FAQ answer saying what AEY is not), add a reason on the same line: `// claims-lint-allow: negated FAQ answer`. For FAQ entries, also set `claimsAllow` so the rendered page carries the exemption into the built HTML.

## Change a status item

File: `src/lib/content/status-ledger.ts`.

```ts
{
	id: 'foreign-reserves',
	area: 'reserves',
	capability: 'Foreign and euro reserves',
	status: 'not_established', // proposed | adopted | in_implementation | operational | not_established
	statusAsOf: '2026-10-19',  // the date the status was confirmed
	explanation: 'Aletheia holds no euro reserves, and the Bank holds no foreign reserves.',
	link: '/reserves'
}
```

Change `status` only with evidence, and update `statusAsOf`. An item in the `issuance`, `reserves` or `convertibility` area **cannot** be `operational` without `evidenceUrl` (a public document proving it); the build fails otherwise.

## Add a publication

Create `src/lib/content/publications/<slug>.md`. The file name is the slug (lower case, digits and hyphens).

```md
---
title: Monetary Policy Framework, Consultation Paper
category: consultation # monetary-policy-statement | annual-report | currency-notice | statistical-release | institutional-policy | research-paper | consultation
publishedAt: 2026-11-02
summary: A short summary, up to 320 characters.
documentUrl: https://rbaletheia.org/documents/framework-consultation.pdf # optional PDF
documentSizeBytes: 482113 # required with a PDF, so the link can show its size
hasHtmlVersion: true
status: published # draft | published | superseded | withdrawn
---

The HTML version of the document, in Markdown.
```

`status: draft` keeps it out of the production site, listings and sitemap. Publish real documents only; never placeholders.

## Add a news notice

Create `src/lib/content/news/<slug>.md`:

```md
---
title: Publication of the issuance principles
publishedAt: 2026-11-02
summary: Up to 300 characters.
category: notice # notice | announcement | statement
draft: false
---

Body in Markdown.
```

## Edit a banknote description

File: `src/lib/content/banknotes.ts`. Describe only what is visible in the artwork. Alt text must be at least 20 characters and mention the SPECIMEN overprint. Security features stay `concept_only` until they are specified (`specified`) or exist on a printed note (`physically_implemented`), and only with a source.

To change the artwork itself, replace the source files in `currency-proto/new curr/` and run `pnpm exec tsx scripts/specimen.ts`. Never place artwork without the overprint in `src/lib/assets/banknotes/`.

## Update FAQ entries

File: `src/lib/content/faq.ts`. Each entry has an `id` (used as the page anchor, so keep it stable), a `group`, the `question`, `answer` paragraphs and optional `relatedLinks`. The FAQ page and its structured data are generated from this file.

## Contact details

File: `src/lib/content/site.ts`, `CONTACT`. Leave `email` and `postal` as `null` until official channels exist; the contact page then shows that channels are being established.
