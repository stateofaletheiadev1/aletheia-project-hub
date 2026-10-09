import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

// House-style share image (brief §18): navy ground, contour field, title.
export const alt = "The Government of Aletheia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const contours = await readFile(path.join(process.cwd(), "public", "contours", "field-a-gold.svg"));
  const src = `data:image/svg+xml;base64,${contours.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0B1628", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={1200} height={750} style={{ position: "absolute", top: -60, left: 0, opacity: 0.22 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "72px 80px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#D8B877", fontSize: 22, letterSpacing: 4, textTransform: "uppercase" }}>
            <div style={{ width: 56, height: 1, background: "#C49A4E" }} />
            The Government of
          </div>
          <div style={{ color: "#FBF8F1", fontSize: 150, fontWeight: 300, letterSpacing: -6, lineHeight: 1, marginTop: 18 }}>ALETHEIA</div>
          <div style={{ color: "#E4D9C0", fontSize: 34, marginTop: 22 }}>{site.officialName}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48, paddingTop: 22, borderTop: "1px solid rgba(196,154,78,0.4)", color: "#B9C3D4", fontSize: 22 }}>
            <span>Founding government-in-formation</span>
            <span>aletheiagov.org</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
