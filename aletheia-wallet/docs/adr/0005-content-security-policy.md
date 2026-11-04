# ADR-0005: Content Security Policy

Status: Accepted

**Decision.** `kit.csp` in auto mode: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'` + Kit
hashes/nonces; `style-src 'self'`; `style-src-attr 'unsafe-inline'`; `connect-src 'self'` + the RPC origin;
`worker-src 'self'`; `frame-ancestors 'none'`; `base-uri 'none'`; `object-src 'none'`. The theme bootstrap is
a same-origin file, not inline script.

**Trade-offs, stated.** `'wasm-unsafe-eval'` allows compiling WebAssembly (Argon2id); it does not allow
`eval` of JavaScript. `style-src-attr 'unsafe-inline'` is needed because Svelte builds DOM from template
strings that carry static style attributes; it permits CSS in attributes only, and no untrusted string is
ever rendered as markup (no `{@html}` with node data). Trusted Types are not enforced for the same reason.
Prerendered pages get the same headers from `vercel.json`.
