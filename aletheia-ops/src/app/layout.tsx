import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Manrope is the only typeface (brief §9). Variable axis, Latin and Latin Extended so names
// with diacritics render correctly; a metric-matched fallback avoids layout shift.
const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s · Operations" },
  description: "Aletheia Government Operations: the workbench behind the public record.",
  applicationName: "Aletheia Government Operations",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0B1628",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
