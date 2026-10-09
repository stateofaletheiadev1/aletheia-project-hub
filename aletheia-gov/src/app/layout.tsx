import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { Colophon } from "@/components/editorial/Colophon";
import { MotionController } from "@/components/motion/MotionController";
import { Header } from "@/components/navigation/Header";
import { site } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
  // CSS is inlined, so font files are discovered at once; without preload the browser
  // fetches only the unicode ranges a page uses (usually Latin only).
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: "website", siteName: site.name, locale: "en_GB" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0B1628",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>
        <a
          href="#main"
          className="fixed left-4 top-4 z-[60] -translate-y-24 bg-parchment-50 px-4 py-3 text-[0.9375rem] font-semibold text-navy-800 focus:translate-y-0"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Colophon />
        <MotionController />
      </body>
    </html>
  );
}
