import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Manrope } from 'next/font/google';
import '../globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { ToastProvider } from '@/components/ui/Toast';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { SkipLink } from '@/components/i18n/SkipLink';
import { LOCALES, LOCALE_META, isLocale } from '@/lib/i18n/config';
import { getMessages, getTranslator } from '@/lib/i18n/server';
import { SITE_URL } from '@/lib/routes';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Only the five official languages exist.
export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { t } = await getTranslator(lang);
  const name = t('The Sovereign Covenant State of Aletheia');
  return {
    title: {
      default: `${name} — ${t('Founding-Phase Platform')}`,
      template: `%s · ${name}`,
    },
    description: t('The founding-phase platform of the Sovereign Covenant State of Aletheia, a seasteading new-country project. Veritas in Foedere.'),
    metadataBase: new URL(SITE_URL),
    keywords: ['Aletheia', 'Sovereign Covenant State', 'new country project', 'seasteading', 'Constitution', 'StableChain', 'founding members'],
    openGraph: {
      title: name,
      description: t('The founding-phase platform of the Sovereign Covenant State of Aletheia, a seasteading new-country project. Veritas in Foedere.'),
      url: SITE_URL,
      siteName: 'The Sovereign Covenant State of Aletheia',
      images: [{ url: '/coat_of_arms.png', width: 1200, height: 630, alt: t('Arms of Aletheia') }],
      locale: LOCALE_META[lang].ogLocale,
      type: 'website',
    },
    icons: { icon: '/coat_of_arms.png', apple: '/coat_of_arms.png' },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  return (
    <html lang={LOCALE_META[lang].intl} className={manrope.variable}>
      <body className="min-h-screen bg-parchment-light text-navy antialiased selection:bg-gold selection:text-navy flex flex-col font-sans">
        <I18nProvider locale={lang} messages={messages}>
          <SkipLink />
          <ToastProvider>
            <SiteChrome />
            <Navbar />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
