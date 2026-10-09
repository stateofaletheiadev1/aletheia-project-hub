# Performance

Budgets from brief §16, checked by `scripts/lighthouse.mjs` (Lighthouse 13, default mobile profile:
simulated slow 4G and 4× CPU slowdown) and by the `gov:lighthouse` CI job.

## Where it stands (9 October 2026, measured on the development machine)

| Metric | Budget | Result |
|---|---|---|
| Accessibility | 100 | **100** on all 6 routes |
| Best practices | ≥ 95 | **100** on all 6 routes |
| SEO (production build) | 100 | **100** on all 6 routes |
| CLS | ≤ 0.05 | **0** on all 6 routes |
| Hero image | ≤ 220 KB AVIF at 1728 px | **26 KB** |
| Performance score | ≥ 95 | **0.73–0.96**: not met |
| LCP (simulated) | ≤ 2.0 s | **1.4–3.6 s**: not met on most routes |
| TBT (proxy for INP) | ≤ 200 ms | **127–687 ms**: noisy, see below |
| First-load JS | ≤ 130 KB gzip | **≈156 KB** transferred: not met |

Real (unthrottled) loads on the same machine: LCP 342 ms on `/government`, 805 ms on `/`.

### Why the simulated LCP does not move

In every run the simulated LCP lands next to time-to-interactive, whichever element is the LCP.
Lighthouse's default simulation schedules the LCP paint after every high-priority request, and that
includes every Next.js script chunk. For this app it therefore measures roughly how long the framework
JavaScript (≈156 KB of the ≈330 KB page) takes over slow 4G. Our own code is about 12 KB of it.

### Measurement noise

Scores on this machine vary widely between identical runs (homepage TBT 293 ms, then 687 ms, with no
code change) because other processes share the CPU, and the simulation multiplies that by 4. The brief
requires measurement on staging; the CI job provides a clean, repeatable machine.

## Changes made, with their effect

| Change | Effect |
|---|---|
| Fixed the standalone build serving full-size images (sharp's native libraries were not traced) | Images 5–26 KB AVIF instead of 151 KB JPEG at every size |
| `experimental.inlineCss` | Removed the only render-blocking request (≈164 ms) |
| Motion controller: deferred to idle time, positions from IntersectionObserver, parallax only while on screen | Homepage TBT 465 → ≈250 ms in comparable runs; no forced reflow |
| Contour SVGs: integer coordinates, one smoothing pass | 72–107 KB → 25–37 KB raw |
| Above-the-fold contour fields load eagerly | They were a late, lazy LCP on interior pages |
| Shorter hero choreography (same order) | Title and ledger strip settle within ≈1.2 s instead of 2.6 s |
| Font preloads off (CSS is inline, so fonts are found at once; only needed subsets download) | ≈27 KB less contention |

### Tried and rejected

- **Inlining the contour SVG into the HTML.** React repeats server output in the RSC payload, so the paths were sent twice and HTML doubled (51 → 100 KB). Reverted.

## Options to meet the budgets

1. Measure in CI or staging first: the job may pass routes this machine cannot.
2. Accept a documented exception for first-load JS and simulated LCP on this stack, keeping the real-user targets (LCP ≤ 2.0 s at the 75th percentile, measured on staging).
3. Remove client components from the homepage (the rail controls) to trim the homepage only; the framework runtime remains.

Choosing between these is the owner's decision.
