# Photography

## Source and licence

All photographs come from Unsplash under the [Unsplash License](https://unsplash.com/license), which
permits use without attribution. They are listed with their source on `/image-credits`, generated from
`src/content/credits.json`.

**Gap:** Unsplash's public search API needs an access key, so photographer names could not be looked up.
`author` is `null` in `credits.json` and the credits page says "photographer to be confirmed". Add names
when an Unsplash access key is available.

## Pipeline

`npm run images` runs `scripts/grade-images.mjs`:

1. Downloads each photo listed in `scripts/image-sources.json` once (cached in `.cache/unsplash/`, not committed).
2. Applies the house grade.
3. Writes `public/images/<name>.jpg` (max 2400 px wide, mozjpeg quality 80) and a 16 px blur placeholder.

The browser never hotlinks Unsplash. `next/image` re-encodes to AVIF/WebP at the requested size: the hero
is served at about 21 KB as AVIF at 1728 px.

## The grade

So the set reads as one body of work:

1. **Screen-blend a solid Covenant Navy (`#15294A`) layer.** Screen lifts the blacks towards navy and leaves the highlights almost untouched: cooled shadows, lifted blacks.
2. **Desaturate to 78 %.**
3. **Raise brightness by 2 %** to compensate for the desaturation.

## Truth rules (brief §5.3)

- No photograph shows land that could be read as Aletheian territory. The hero is open water with no coastline.
- Photos of real infrastructure (ships, wind farms, buildings, construction) are captioned "Illustrative photograph" where they illustrate a programme.
- No text sits over a photograph except the homepage title, which sits over open water under a navy gradient.
