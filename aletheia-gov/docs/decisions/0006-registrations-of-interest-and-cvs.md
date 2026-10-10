# ADR 0006: Registrations of interest across institutions, with CVs

- Status: Accepted
- Date: 2026-10-10

## Context

The first version tied a registration to one institution. People want to help found several, or
any. The owner asked for a CV with every registration, and for reviewers to read and preview it.

## Decision

- **One registration per person** (`interest_registrations`), found by `subject`, a blind index
  of the email. It holds a list of institutions (or `any`), expertise, notes, CVs and a status
  (`new`, `contacted`, `archived`). Registering again merges: institutions and expertise are
  added, the note is appended, the CV is added (the last 3 are kept), and the reference
  (`AGV-EOI-YYYY-NNNN`) stays the same. The confirmation lists only what was just ticked.
- **Form:** `/register-interest` (linked from the header on every page), every institution page
  (its own institution pre-ticked) and Build Aletheia. Spam checks: a hidden field, a minimum
  fill time, 5 submissions per hour per address. A double submit saves once (idempotency key).
- **CV required**, PDF only, at most 2 MB, judged by its bytes (header, `%%EOF`, and no
  JavaScript, launch actions, embedded files, rich media or XFA), never by its name.
- **Storage:** encrypted under the person's key (AES-256-GCM), split into 128 KiB chunks in
  `attachments`, each sealed with its file id and position as associated data, stored as base64
  in the document. The SHA-256 of the original is kept and checked on every read.
- **Reading:** reviewers see decrypted details on the registration page, with *Preview CV* and
  *Download PDF*. The preview draws the pages with pdf.js on canvases in a same-origin worker,
  so the browser's PDF plug-in is not used and no script in the file runs. Downloads are sent
  as attachments with `nosniff`, a sandbox CSP and `no-store`. Both are audited separately
  (`cv.preview`, `cv.download`).
- **Readable fields:** institutions, expertise, status and dates stay unencrypted so the
  workbench can filter and count.

## Consequences

- Retention and erasure are in [data-governance](../data-governance.md).
- No confirmation email yet: email delivery is not set up.
- `pdfjs-dist` is pinned (6.3.289) and only loaded on the workbench when a preview opens.
