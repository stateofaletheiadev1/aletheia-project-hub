# Content guide

Every change below is a single-file edit. All content is validated when the site builds: a missing field, a wrong date format or an unsupported status stops the build with a message that names the file and field.

Run `pnpm verify` before publishing. It includes the forbidden-claims check.

## Copy rules

- **Say less.** One short, true sentence is better than a detailed list. Do not list what is missing, what has not been decided, or internal arrangements.
- Describe intentions as intentions: "is proposed", "is intended", "will be published".
- Never state figures, targets, rates or arrangements that do not exist.
- Name the institution "Reserve Bank of Aletheia" and the State "Sovereign Covenant State of Aletheia". No hype.

The claims linter (`pnpm lint:claims`) rejects the phrases listed in `scripts/claims-rules.ts`. If a sentence must use one to **negate** it (for example, an FAQ answer saying what AEY is not), add a reason on the same line: `// claims-lint-allow: negated FAQ answer`. For FAQ entries, also set `claimsAllow` so the rendered page carries the exemption into the built HTML.

## Change a status item

File: `src/lib/content/status-ledger.ts`.

```ts
{
	id: 'reserves-and-exchange',
	area: 'reserves',
	capability: 'Reserves and exchange',
	status: 'not_established', // proposed | adopted | in_implementation | operational | not_established
	statusAsOf: '2026-10-19',  // the date the status was confirmed
	explanation: 'To be set out in published policy.', // one short line
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

File: `src/lib/content/banknotes.ts`. Describe only what is visible in the artwork. Keep descriptions to one short line per side. Alt text must be at least 20 characters and say the image is a specimen.

To change the artwork itself, replace the source files in `currency-proto/new curr/` and run `pnpm exec tsx scripts/specimen.ts`. Never place artwork without the overprint in `src/lib/assets/banknotes/`.

## Update FAQ entries

File: `src/lib/content/faq.ts`. Each entry has an `id` (used as the page anchor, so keep it stable), a `group`, the `question`, `answer` paragraphs and optional `relatedLinks`. The FAQ page and its structured data are generated from this file.

## Contact details

File: `src/lib/content/site.ts`, `CONTACT`. Leave `email` and `postal` as `null` until official channels exist; the contact page then shows that channels are being established.

## Languages

The site is published in English. The official languages of the State (Deutsch, Nederlands, Српски, Italiano) are listed in `src/lib/i18n/locales.ts` with `available: false`.

To publish a language:

1. Obtain an approved translation of the pages and content files.
2. Add the translated pages under `src/routes/<code>/` (for example `/de/about`), mirroring the English routes.
3. Set `available: true` for that language.

The language switcher in the top bar appears automatically once two or more languages are available. Never publish machine translations without review.

## Search

Search is built from the published pages at every build (`scripts/search-index.ts`), so new pages are searchable without any extra step.
