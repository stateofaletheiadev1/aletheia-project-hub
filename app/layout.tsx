import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'The Covenant State of Aletheia — Official Digital Platform',
  description:
    'Official digital front door and civic operating platform of the Covenant State of Aletheia. Veritas in Foedere.',
  metadataBase: new URL('https://stateofaletheia.org'),
  keywords: [
    'Aletheia',
    'Covenant State',
    'Digital State',
    'Constitution',
    'StableChain',
    'E-Residency',
    'Antioch',
    'ADSS',
  ],
  openGraph: {
    title: 'The Covenant State of Aletheia',
    description: 'Building a new standard for life, technology, and civic infrastructure.',
    url: 'https://stateofaletheia.org',
    siteName: 'Aletheia Digital State',
    images: [
      {
        url: '/coat_of_arms.png',
        width: 1200,
        height: 630,
        alt: 'Arms of Aletheia',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  icons: {
    icon: '/coat_of_arms.png',
    apple: '/coat_of_arms.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-screen bg-parchment-light text-navy antialiased selection:bg-gold selection:text-navy flex flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-navy focus:text-parchment focus:border focus:border-gold"
        >
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
