# Design review

Brief §16. Screenshots: `docs/design/screenshots/` (Playwright, Chromium, reduced motion, full
page) of `/sign-in`, `/design`, `/design/briefing` (populated and `?state=empty`),
`/design/register` (populated and `?state=empty`) and `/design/folio`, each at 375, 768, 1280
and 1600 px. Compared with the portal's committed screenshots (`aletheia-gov/docs/design/review/`).

All content in the archetypes is specimen content, labelled as such on every page.

## Round 1 (15 October 2026): defects found and fixed

| Defect | Fix |
|---|---|
| A thin line above every small capital label | The class was named `overline`, which is also a Tailwind utility (`text-decoration: overline`). Renamed `.caps` |
| Folio overflowed by 129–235 px at 375, 1280 and 1600 | A long attachment name widened the custody column; the column now has `min-width: 0` and names truncate with the full name on hover |
| Register title column crushed at 1280 | Fixed table layout; title takes the remaining width; classification moved under the title, shown only when not Public; "With" column only from 1600 |
| Action labels wrapped ("Approve / decision") | No wrapping on action labels |
| Specimen notice collided with the briefing masthead | Notice moved into the frame, under the masthead |
| Masthead lockup clipped by the environment marker at 375 | Mark and overline hidden below 640 px; marker reads "Dev" |
| Stage invisible in "In progress" on phones | Status tag shown under the title below 768 px |
| 200-character folio titles set at 30 px were heavy | Titles over 90 characters set at the h2 size |

Round 2: no horizontal overflow at any width on any page; no console errors.

## The questions of §16

**Could this be mistaken for a generic admin template or an AI-generated dashboard?** No. There
are no metric cards, charts, gradients or illustration. The overview is a dated briefing with
numbered items in priority order, set like the portal's register pages. Registers are ruled
ledgers with references first.

**Does it visibly belong to the aletheiagov.org family?** Yes: the same navy (`#0B1628`) band
with the hexagon mark and gold overline, parchment surfaces, section marks with a short gold
rule, two-digit ordinals, placeholder references (`AGV-DEC-····-····`) in empty registers, the
contour field on the sign-in screen and briefing masthead, and the portal's sentence-case voice.
It is denser and lighter in display weight than the portal, as a working tool should be.

**Is the most important action obvious within two seconds?** On the folio, the only filled navy
button is the next action. On the briefing, item 01 is the first and largest thing after the date.

**Is gold rare enough to mean "official"?** Gold appears as the section-mark rule, the published
status and receipt, the seal dot beside published references, the notification count and the
masthead overline. Never as text on light surfaces (a test enforces that seal gold fails 4.5:1 and
uses `seal-ink` instead).

**Are authority, information, warnings and destruction distinct?** Navy for authority and
information; amber for returned and warnings; brick for rejection, failure and destructive
buttons; green for approval. Each has a glyph as well as a colour.

**Does it hold with 200-character titles, many errors and zero records?** Long titles clamp in
registers and step down on the folio; the form specimen shows a two-error summary linked to fields;
empty states say what is absent and why.

**Is there anything that does no work?** The briefing's contour field is ornament; it is at 6 %
opacity and only in the masthead band, as the brief allows.

## Not yet reviewed

- Composer, Review (side-by-side), Publication sheet, Administration and Audit archetypes: not built.
- Keyboard and screen-reader passes (VoiceOver, NVDA): not done.
- axe checks: not yet wired (Phase 7).
- Real content lengths from live records: none exist yet.
