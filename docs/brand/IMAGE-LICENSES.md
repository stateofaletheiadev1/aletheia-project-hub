# IMAGE LICENSES & ASSET REGISTER
**The Sovereign Covenant State of Aletheia**  
*Document Version: 1.0.0 (Development Asset Audit)*  
*Rule (§6): No visible "Unsplash" branding or source attribution inside the website UI. Record provenance privately here.*

| File Name | Intended Role | Subject / Art Direction | Source Provider | License | UI Attribution Required |
|---|---|---|---|---|---|
| `hero_maritime.jpg` | Homepage Hero Backdrop | European maritime oceanic horizon | Unsplash | Unsplash Free Commercial License | No |
| `architecture_antioch.jpg` | Antioch Masterplan Section | Modern geometric European civic architecture | Unsplash | Unsplash Free Commercial License | No |
| `maritime_port.jpg` | St. Brendan State & Infrastructure | Deepwater container port & maritime shipping | Unsplash | Unsplash Free Commercial License | No |
| `clean_energy.jpg` | Benedict State & Energy Grid | Offshore renewable wind energy platforms | Unsplash | Unsplash Free Commercial License | No |
| `cyber_defence.jpg` | Aletheian Cybersecurity Department | High-assurance data infrastructure & cryptography | Unsplash | Unsplash Free Commercial License | No |
| `civic_assembly.jpg` | Covenant Assembly & Constitution | Modern parliamentary hall and civic chamber | Unsplash | Unsplash Free Commercial License | No |
| `research_lab.jpg` | Augustine State & Healthcare | Advanced scientific research laboratory | Unsplash | Unsplash Free Commercial License | No |

## CDN Photographic Library (`lib/imagery.ts`)

Since October 2026, page photography is served directly from the Unsplash CDN (`images.unsplash.com`) under the Unsplash Licence (free commercial use, no attribution required). In line with §6, **no attribution, captions or source tags appear in the UI**; the canonical register is the `PHOTOS` map in `lib/imagery.ts`, where each key maps to an Unsplash photo ID.

Selection rules applied to every entry:

- The ID was verified to resolve (HTTP 200) and the image was reviewed visually.
- No identifiable public figures, no foreign national flags, and no non-euro banknotes.
- No recognisable foreign skylines, landmarks, signage or maps that could be mistaken for Aletheian territory.

To add a photo: verify the ID resolves, review it against these rules, then add a descriptive key to `PHOTOS` and use `unsplash(key, width)`.
