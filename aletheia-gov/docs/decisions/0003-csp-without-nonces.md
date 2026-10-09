# ADR 0003: Content Security Policy without nonces on static pages

- Status: Accepted (revisit when the workbench is built)
- Date: 2026-10-09

## Context

The brief (§14) asks for a nonce-based CSP with no `unsafe-inline` scripts, and also for statically
generated public pages (§16). Next 16 documents that nonces require dynamic rendering of every page, and
that Partial Prerendering is incompatible with nonces. Next also injects inline scripts (the RSC payload),
which a hash-free, nonce-free policy must allow. The experimental SRI option covers external chunks only.

## Decision

- Public pages stay static. The CSP is set in `next.config.ts` headers: `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, no third-party origins at all, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`.
- The site loads nothing from other origins, so the practical XSS surface is limited to inline injection. React escaping and the `react/no-danger` lint rule close that path: there is no `dangerouslySetInnerHTML` anywhere.
- When `/workbench` and `/account` are built (dynamic, authenticated), they get a nonce-based CSP from `proxy.ts` with no `unsafe-inline`.

## Consequences

- This is a deliberate, documented deviation from the letter of §14 for the public pages only.
- Verified on the production build: no CSP violations on any public route (`scripts/audit.mjs`).
