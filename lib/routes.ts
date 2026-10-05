import type { Metadata } from 'next';

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
  '/': { title: 'Official Digital Platform', description: 'Official digital front door and civic operating platform of the Covenant State of Aletheia. Veritas in Foedere.', priority: 1, changeFrequency: 'weekly' },
  '/aletheia': { title: 'Discover Aletheia', description: 'The founding idea, maritime heritage, national symbols and civic compact of the Covenant State of Aletheia.', priority: 0.9, changeFrequency: 'monthly' },
  '/vision': { title: 'National Vision', description: 'The long-term civic compact of Aletheia: provable government, European standards, and a 2040 horizon.', priority: 0.8, changeFrequency: 'monthly' },
  '/identity': { title: 'National Symbols', description: 'The coat of arms, Star of Truth, national flag, state ensign and heraldic standards of Aletheia.', priority: 0.6, changeFrequency: 'yearly' },
  '/society': { title: 'Life in Aletheia', description: 'Culture, languages, faith, family, housing and everyday civic life in the Covenant State of Aletheia.', priority: 0.8, changeFrequency: 'monthly' },
  '/healthcare': { title: 'Health & Social Care', description: 'Universal covenant healthcare, the National Health Registry, Augustine medical campus and family care in Aletheia.', priority: 0.8, changeFrequency: 'monthly' },
  '/education': { title: 'Education & Research', description: 'Schools, the National University of Aletheia, research grants, scholarships and lifelong learning.', priority: 0.8, changeFrequency: 'monthly' },
  '/transparency': { title: 'Public Transparency', description: 'Audited public accounts, ledger verification and the status taxonomy behind every Aletheian institution.', priority: 0.8, changeFrequency: 'weekly' },
  '/news': { title: 'Official Gazette & News', description: 'Decrees, appointments, engineering milestones and statements published in the Official Gazette of Aletheia.', priority: 0.9, changeFrequency: 'daily' },
  '/documents': { title: 'Public Documents', description: 'The Covenant, enacted Acts, protocol standards and official reports of the Covenant State.', priority: 0.7, changeFrequency: 'weekly' },
  '/contact': { title: 'Contact & Representation', description: 'Diplomatic missions, press enquiries, citizen services and official correspondence channels.', priority: 0.6, changeFrequency: 'monthly' },
  '/faq': { title: 'Frequently Asked Questions', description: 'Clear answers on citizenship, e-residency, the AEY, StableChain, taxation and the status of Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/government': { title: 'Government & Ministries', description: 'The Covenant Assembly, Council of the States, Chancellor and the nine capped ministries of Aletheia.', priority: 0.9, changeFrequency: 'monthly' },
  '/government/ministry-of-foreign-affairs': { title: 'Ministry of Foreign Affairs & Justice', description: 'Bilateral covenants, diplomatic representation, passports and the justice system of Aletheia.', priority: 0.6, changeFrequency: 'monthly' },
  '/government/ministry-of-maritime': { title: 'Ministry of Maritime Affairs', description: 'Flag registry, maritime zones, port administration and North Sea stewardship.', priority: 0.6, changeFrequency: 'monthly' },
  '/constitution': { title: 'The Constitution', description: 'The Covenant of Aletheia: searchable articles, permalinks and the supreme law of the Republic.', priority: 0.9, changeFrequency: 'monthly' },
  '/laws': { title: 'Codified Statutes', description: 'The register of enacted Acts of the Covenant Assembly, each inscribed and verifiable on the public ledger.', priority: 0.7, changeFrequency: 'weekly' },
  '/citizenship/apply': { title: 'Apply for Citizenship', description: 'Check your eligibility for naturalisation or the Covenant Investor route, and begin your application.', priority: 0.9, changeFrequency: 'monthly' },
  '/registry': { title: 'National Registry & Revenue', description: 'Registered e-residents and citizens, and every guilder raised to build the maritime republic.', priority: 0.8, changeFrequency: 'weekly' },
  '/citizenship': { title: 'Citizenship', description: 'Membership by covenant: rights, obligations, naturalisation, the Covenant Investor route and the public Covenant Oath.', priority: 0.9, changeFrequency: 'monthly' },
  '/e-residency': { title: 'E-Residency', description: 'Digital state access for global entrepreneurs: identity, 15-minute company formation and APN settlement.', priority: 0.9, changeFrequency: 'monthly' },
  '/immigration': { title: 'Immigration & Visas', description: 'Visas, residence permits and paperless biometric border administration in Aletheia.', priority: 0.8, changeFrequency: 'monthly' },
  '/passport': { title: 'The Aletheian Passport', description: 'The ICAO Doc 9303 TD3 eMRTD passport in Covenant Burgundy: security features and PKI.', priority: 0.7, changeFrequency: 'monthly' },
  '/development': { title: 'Territorial Development', description: 'Antioch, the four founding states, the interactive territorial map and the national masterplan.', priority: 0.8, changeFrequency: 'monthly' },
  '/infrastructure': { title: 'Maritime Infrastructure', description: 'Ports, maritime platforms and resilient North Sea civil engineering.', priority: 0.7, changeFrequency: 'monthly' },
  '/energy': { title: 'Sovereign Energy Grid', description: 'Offshore wind, small modular reactors, green hydrogen and desalination for a net-zero republic.', priority: 0.7, changeFrequency: 'monthly' },
  '/economy': { title: 'Economy', description: 'A tax-free, reserve-backed economy: the AEY, covenant bonds and the sovereign endowment.', priority: 0.9, changeFrequency: 'monthly' },
  '/treasury': { title: 'Treasury & Endowment', description: 'The sovereign endowment, public balance sheet and revenue model of a republic without income tax.', priority: 0.7, changeFrequency: 'monthly' },
  '/central-bank': { title: 'Central Bank & Reserve', description: 'The Monetary Board, reserve invariants and settlement policy of the Central Bank of Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/aey': { title: 'The Aletheian Guilder (AEY)', description: 'The sovereign unit of account: 1:1 EUR parity backed by provable, fully audited reserves.', priority: 0.8, changeFrequency: 'monthly' },
  '/stablechain': { title: 'Aletheia StableChain', description: 'National ledger infrastructure: 500 ms finality, provable reserves and fixed settlement fees.', priority: 0.8, changeFrequency: 'monthly' },
  '/business': { title: 'Business Platform', description: '15-minute digital incorporation, commercial licensing and the corporate registry of Aletheia.', priority: 0.8, changeFrequency: 'monthly' },
  '/invest': { title: 'Sovereign Investment', description: 'Covenant development bonds, infrastructure funds and strategic partnerships with Aletheia.', priority: 0.7, changeFrequency: 'monthly' },
  '/technology': { title: 'Digital State & Technology', description: 'Digital identity, state registries and the technical architecture of the Aletheian digital state.', priority: 0.7, changeFrequency: 'monthly' },
  '/security': { title: 'Security & Civil Defence', description: 'Civilian governance of national security, resilience planning and civil defence in Aletheia.', priority: 0.6, changeFrequency: 'monthly' },
  '/adss': { title: 'Aletheian Defence & Security Service', description: 'The ADSS: navy and coast guard, police, immigration, cyber and emergency directorates under civilian command.', priority: 0.8, changeFrequency: 'monthly' },
  '/adss/cybersecurity': { title: 'Aletheian Cybersecurity Department', description: 'National cyber defence, CERT/CSIRT, validator protection and coordinated vulnerability disclosure.', priority: 0.7, changeFrequency: 'weekly' },
  '/design-system': { title: 'Sovereign Design System', description: 'Colours, typography, components and status taxonomy of the Aletheia digital platform.', priority: 0.3, changeFrequency: 'yearly' },
  '/privacy': { title: 'Privacy Notice', description: 'How the Covenant State of Aletheia collects, protects and limits the use of personal data on this platform.', priority: 0.4, changeFrequency: 'yearly' },
  '/terms': { title: 'Terms of Use', description: 'Terms governing use of the official digital platform of the Covenant State of Aletheia.', priority: 0.3, changeFrequency: 'yearly' },
  '/accessibility': { title: 'Accessibility Statement', description: 'Our commitment to WCAG 2.2 AA, known limitations, and how to request an accessible format.', priority: 0.3, changeFrequency: 'yearly' },
} satisfies Record<string, PublicRoute>;

export type PublicPath = keyof typeof PUBLIC_ROUTES;

/** Metadata for a registered public route (title is templated by the root layout). */
export function routeMetadata(path: PublicPath): Metadata {
  const route = PUBLIC_ROUTES[path];
  return {
    title: path === '/' ? { absolute: `The Covenant State of Aletheia — ${route.title}` } : route.title,
    description: route.description,
    alternates: { canonical: path },
    openGraph: {
      title: route.title,
      description: route.description,
      url: path,
      siteName: 'Aletheia Digital State',
      images: [{ url: '/coat_of_arms.png', alt: 'Arms of Aletheia' }],
    },
  };
}

/** Private, authenticated surfaces must never be indexed. */
export const PRIVATE_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
