# DDR-0002: One Icon component over path data

The 40 icons are path data in `src/lib/design/icons/paths.ts`, drawn on a 24 px grid with a 1.25 px
square-capped stroke, rendered by one `Icon.svelte`. One component with a typed `name` keeps every icon on
the same stroke, cap and accessibility rules (decorative by default, titled when meaningful) and costs one
module instead of forty.
