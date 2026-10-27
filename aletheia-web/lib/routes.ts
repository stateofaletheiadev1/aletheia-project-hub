import type { Metadata } from 'next';
import { LOCALES, LOCALE_META, isLocale, localizeHref, type Locale } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';

export const SITE_URL = 'https://stateofaletheia.org';

interface PublicRoute {
  title: string;
  description: string;
  /** Sitemap priority, 0–1. */
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

/**
 * Registry of every public page. Drives per-page <title>/description and
 * sitemap.xml, so a new page only needs to be declared here once.
 */
export const PUBLIC_ROUTES = {
  '/': { title: 'Founding-Phase Platform', description: 'The founding-phase platform of the Sovereign Covenant State of Aletheia, a seasteading new-country project. Veritas in Foedere.', priority: 1, changeFrequency: 'weekly' },
  '/aletheia': { title: 'Discover Aletheia', description: 'The founding idea, maritime heritage, national symbols and civic compact of the Sovereign Covenant State of Aletheia.', priority: 0.9, changeFrequency: 'monthly' },
  '/about': { title: 'Founding Team', description: 'The people building the Sovereign Covenant State of Aletheia, its advisors, and how to reach them.', priority: 0.8, changeFrequency: 'monthly' },
  '/roadmap': { title: 'Roadmap', description: 'An honest roadmap: from a founding community and digital institutions to a pilot platform.', priority: 0.8, changeFrequency: 'monthly' },
  '/thesis': { title: 'Founding Thesis', description: 'The legal structure, governance, economic model, host regions and diplomatic strategy behind Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/founding-members': { title: 'Become a Founding Member', description: 'Register interest in Aletheia’s founding community. Free: Aletheia does not sell citizenship, residency, passports or currency.', priority: 0.9, changeFrequency: 'monthly' },
  '/vision': { title: 'National Vision', description: 'The long-term civic compact of Aletheia: provable government, European standards and a design horizon.', priority: 0.8, changeFrequency: 'monthly' },
  '/identity': { title: 'National Symbols', description: 'The coat of arms, Star of Truth, national flag, state ensign and heraldic standards of Aletheia.', priority: 0.6, changeFrequency: 'yearly' },
  '/society': { title: 'Life in Aletheia', description: 'The proposed culture, languages, family life and civic calendar of the Sovereign Covenant State of Aletheia.', priority: 0.8, changeFrequency: 'monthly' },
  '/healthcare': { title: 'Health & Social Care', description: 'The proposed covenant healthcare model: patient-held records, a medical campus and family care.', priority: 0.8, changeFrequency: 'monthly' },
  '/education': { title: 'Education & Research', description: 'Proposed schools, a National University of Aletheia, research grants and lifelong learning.', priority: 0.8, changeFrequency: 'monthly' },
  '/transparency': { title: 'Status & Disclaimers', description: 'What Aletheia is, and is not, today: the founding-phase statement and the status of every national asset.', priority: 0.9, changeFrequency: 'weekly' },
  '/news': { title: 'Gazette & News', description: 'Founding-phase records, design studies and statements. These documents have no legal force.', priority: 0.9, changeFrequency: 'weekly' },
  '/documents': { title: 'Public Documents', description: 'The draft Covenant, proposed Acts, protocol standards and founding reports of Aletheia.', priority: 0.7, changeFrequency: 'weekly' },
  '/contact': { title: 'Contact', description: 'Press enquiries, partnerships, government enquiries and general correspondence.', priority: 0.6, changeFrequency: 'monthly' },
  '/faq': { title: 'Frequently Asked Questions', description: 'Clear answers on founding membership, the AEY, StableChain, territory and the status of Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/government': { title: 'Government & Ministries', description: 'The proposed Covenant Assembly, Council of States, Chancellor and nine capped ministries of Aletheia.', priority: 0.9, changeFrequency: 'monthly' },
  '/government/ministry-of-foreign-affairs': { title: 'Ministry of Foreign Affairs & Justice', description: 'The proposed ministry for diplomatic relations, treaties, justice and the travel-document design.', priority: 0.6, changeFrequency: 'monthly' },
  '/government/ministry-of-maritime': { title: 'Ministry of Maritime Affairs', description: 'The proposed ministry for a flag registry, port administration and marine stewardship.', priority: 0.6, changeFrequency: 'monthly' },
  '/constitution': { title: 'The Constitution', description: 'The complete draft Constitution of Aletheia: Preamble, 23 Parts, 236 Articles and 10 Schedules, searchable and downloadable. A proposal without legal force.', priority: 0.9, changeFrequency: 'monthly' },
  '/laws': { title: 'Proposed Statutes', description: 'The register of proposed Acts, each published with its hash so the text can be checked.', priority: 0.7, changeFrequency: 'weekly' },
  '/citizenship/apply': { title: 'Applications Closed', description: 'Aletheia does not accept citizenship applications. Register interest as a Founding Member instead.', priority: 0.2, changeFrequency: 'yearly' },
  '/registry': { title: 'The Founding Register', description: 'How Aletheia’s founding register is designed, and what it records.', priority: 0.6, changeFrequency: 'monthly' },
  '/citizenship': { title: 'Citizenship', description: 'Membership by covenant: proposed rights and obligations. Citizenship only by birth or naturalisation, once Aletheia is established as a state.', priority: 0.9, changeFrequency: 'monthly' },
  '/e-residency': { title: 'E-Residency', description: 'A proposed digital residency for global entrepreneurs. No applications are accepted.', priority: 0.8, changeFrequency: 'monthly' },
  '/immigration': { title: 'Immigration & Residence', description: 'Proposed visas and residence permits, for a future Aletheian seastead.', priority: 0.7, changeFrequency: 'monthly' },
  '/design/travel-document': { title: 'Travel Document Design Concept', description: 'A design concept for an Aletheian travel document. Not a travel document.', priority: 0.5, changeFrequency: 'yearly' },
  '/development': { title: 'The Seastead', description: 'Aletheia’s plan for a sovereign seastead, and the Antioch design studies for its long-term future.', priority: 0.9, changeFrequency: 'monthly' },
  '/infrastructure': { title: 'Ports & Coastal Works', description: 'Design studies for ports and coastal engineering, to be built at sea, on platforms Aletheia owns.', priority: 0.6, changeFrequency: 'monthly' },
  '/energy': { title: 'Clean Energy', description: 'Design studies for offshore wind, small modular reactors, green hydrogen and desalination.', priority: 0.6, changeFrequency: 'monthly' },
  '/economy': { title: 'Economy', description: 'The proposed economy of Aletheia: the AEY, the Covenant Endowment and a revenue model without income tax.', priority: 0.8, changeFrequency: 'monthly' },
  '/treasury': { title: 'Treasury & Endowment', description: 'The proposed Covenant Endowment, public balance sheet and revenue model.', priority: 0.7, changeFrequency: 'monthly' },
  '/central-bank': { title: 'Reserve Bank of Aletheia', description: 'The Reserve Bank of Aletheia, the proposed monetary institution of the Sovereign Covenant State of Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/aey': { title: 'The Aletheian Guilder (AEY)', description: 'The proposed national currency of Aletheia. Not issued to the public, and not legal tender or e-money.', priority: 0.8, changeFrequency: 'monthly' },
  '/aey/paper-currency': { title: 'AEY Paper Currency', description: 'Design concepts for an AEY banknote series, 1 to 100 AEY.', priority: 0.6, changeFrequency: 'monthly' },
  '/stablechain': { title: 'Aletheia StableChain', description: 'Ledger infrastructure on Mainnet Beta: 500 ms slots, finality in about a second and fixed settlement fees.', priority: 0.8, changeFrequency: 'monthly' },
  '/business': { title: 'Business Platform', description: 'Proposed digital incorporation, commercial licensing and a corporate registry for Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/invest': { title: 'Investment & Partnerships', description: 'How future partners and investors could take part in building Aletheia. Nothing is offered or sold.', priority: 0.6, changeFrequency: 'monthly' },
  '/technology': { title: 'Digital State & Technology', description: 'Digital identity design, registries and StableChain Mainnet Beta behind the Aletheian digital state.', priority: 0.7, changeFrequency: 'monthly' },
  '/security': { title: 'Resilience & Civil Protection', description: 'Proposed civilian governance of resilience, cyber protection and emergency response.', priority: 0.5, changeFrequency: 'monthly' },
  '/adss': { title: 'Resilience & Civil Protection', description: 'Planned civil-protection and resilience functions under civilian command: rescue, police, immigration and cyber.', priority: 0.6, changeFrequency: 'monthly' },
  '/adss/cybersecurity': { title: 'Aletheian Cybersecurity Department', description: 'A planned department to protect Aletheia’s digital infrastructure, with coordinated vulnerability disclosure.', priority: 0.6, changeFrequency: 'monthly' },
  '/design-system': { title: 'Sovereign Design System', description: 'Colours, typography, components and status taxonomy of the Aletheia digital platform.', priority: 0.3, changeFrequency: 'yearly' },
  '/privacy': { title: 'Privacy Notice', description: 'How Aletheia collects, protects and limits the use of personal data on this platform.', priority: 0.4, changeFrequency: 'yearly' },
  '/terms': { title: 'Terms of Use', description: 'Terms governing use of the founding-phase platform of the Sovereign Covenant State of Aletheia.', priority: 0.3, changeFrequency: 'yearly' },
  '/accessibility': { title: 'Accessibility Statement', description: 'Our commitment to WCAG 2.2 AA, known limitations, and how to request an accessible format.', priority: 0.3, changeFrequency: 'yearly' },
} satisfies Record<string, PublicRoute>;

export type PublicPath = keyof typeof PUBLIC_ROUTES;

/** hreflang alternates for a path in all five official languages. */
export function languageAlternates(path: string) {
  const languages: Record<string, string> = { 'x-default': path };
  for (const l of LOCALES) languages[LOCALE_META[l].intl] = localizeHref(path, l);
  return languages;
}

/** Localised metadata for a registered public route (title is templated by the root layout). */
export async function localizedRouteMetadata(path: PublicPath, locale: Locale): Promise<Metadata> {
  const route = PUBLIC_ROUTES[path];
  const { t } = await getTranslator(locale);
  const title = t(route.title);
  const description = t(route.description);
  return {
    title: path === '/' ? { absolute: `${t('The Sovereign Covenant State of Aletheia')} — ${title}` } : title,
    description,
    alternates: { canonical: localizeHref(path, locale), languages: languageAlternates(path) },
    openGraph: {
      title,
      description,
      url: localizeHref(path, locale),
      siteName: 'The Sovereign Covenant State of Aletheia',
      locale: LOCALE_META[locale].ogLocale,
      images: [{ url: '/coat_of_arms.png', alt: t('Arms of Aletheia') }],
    },
  };
}

/** `export const generateMetadata = routeMetadataFor('/treasury')` in a route's layout or page. */
export function routeMetadataFor(path: PublicPath) {
  return async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => {
    const { lang } = await params;
    return localizedRouteMetadata(path, isLocale(lang) ? lang : 'en');
  };
}

/** Private, authenticated surfaces must never be indexed. */
export const PRIVATE_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
