// Downloads the photographs listed in image-sources.json from Unsplash once,
// applies the house grade, and writes self-hosted files to public/images/.
//
// The grade (documented in docs/design/photography.md):
//   1. screen-blend a deep navy (#15294A) layer: lifts the blacks and cools the shadows
//   2. desaturate to 78 %
//   3. a slight overall lift in brightness to compensate
// The browser never hotlinks Unsplash; next/image re-encodes these to AVIF/WebP.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, ".cache", "unsplash");
const outDir = path.join(root, "public", "images");
const sources = JSON.parse(await readFile(path.join(root, "scripts", "image-sources.json"), "utf8"));

await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const exists = (p) => access(p).then(() => true, () => false);

const credits = [];
for (const src of sources) {
  const raw = path.join(cacheDir, `${src.unsplashId}.jpg`);
  if (!(await exists(raw))) {
    const url = `https://images.unsplash.com/photo-${src.unsplashId}?w=2400&q=90&fm=jpg`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed ${res.status}: ${src.name}`);
    await writeFile(raw, Buffer.from(await res.arrayBuffer()));
  }

  const base = sharp(raw).rotate();
  const { width, height } = await base.metadata();
  const navy = await sharp({
    create: { width, height, channels: 3, background: { r: 21, g: 41, b: 74 } },
  })
    .png()
    .toBuffer();

  const out = path.join(outDir, `${src.name}.jpg`);
  await sharp(raw)
    .rotate()
    .composite([{ input: navy, blend: "screen" }])
    .modulate({ saturation: 0.78, brightness: 1.02 })
    .resize({ width: 2400, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true })
    .toFile(out);

  const meta = await sharp(out).metadata();
  const tiny = await sharp(out).resize(16).blur(1.2).jpeg({ quality: 50 }).toBuffer();
  credits.push({
    file: `/images/${src.name}.jpg`,
    width: meta.width,
    height: meta.height,
    blur: `data:image/jpeg;base64,${tiny.toString("base64")}`,
    alt: src.alt,
    subject: src.subject,
    use: src.use,
    source: "Unsplash",
    sourceUrl: `https://images.unsplash.com/photo-${src.unsplashId}`,
    author: null,
    licence: "Unsplash License",
    licenceUrl: "https://unsplash.com/license",
  });
  console.log(`graded ${src.name} ${meta.width}x${meta.height}`);
}

await writeFile(path.join(root, "src", "content", "credits.json"), JSON.stringify(credits, null, 2) + "\n");
console.log(`wrote ${credits.length} credits`);
