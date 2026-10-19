/** Site identity, navigation and contact. Contact fields stay null until real channels exist. */
import type { Contact } from './schema';

export const SITE = {
	name: 'Reserve Bank of Aletheia',
	shortName: 'RBA',
	state: 'Sovereign Covenant State of Aletheia',
	currency: { name: 'Aletheian Guilder', plural: 'Aletheian Guilders', code: 'AEY' },
	description:
		'The Reserve Bank of Aletheia is being established as the monetary institution of the Sovereign Covenant State of Aletheia, and the issuer of its currency, the Aletheian Guilder (AEY).',
	stateUrl: 'https://www.stateofaletheia.org',
	governmentUrl: 'https://www.aletheiagov.org',
	locale: 'en_GB'
} as const;

export interface NavLink {
	href: string;
	label: string;
	description?: string;
}

export interface NavGroup {
	label: string;
	children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => 'children' in item;

export const PRIMARY_NAV: NavItem[] = [
	{
		label: 'About the Bank',
		children: [
			{ href: '/about', label: 'About the Bank', description: 'Purpose, mandate and principles' },
			{ href: '/about/governance', label: 'Governance', description: 'Board, committees and law' },
			{
				href: '/about/international',
				label: 'International cooperation',
				description: 'Working with other institutions'
			},
			{ href: '/explained', label: 'The Bank explained', description: 'Central banking in brief' },
			{ href: '/about/careers', label: 'Careers', description: 'Working at the Bank' }
		]
	},
	{ href: '/monetary-policy', label: 'Monetary Policy' },
	{
		label: 'Financial Stability',
		children: [
			{
				href: '/financial-stability',
				label: 'Financial stability',
				description: 'A sound financial system'
			},
			{ href: '/payments', label: 'Payments', description: 'Settlement and infrastructure' },
			{ href: '/reserves', label: 'Reserves', description: 'Reserve and exchange policy' }
		]
	},
	{
		label: 'The Guilder',
		children: [
			{ href: '/currency', label: 'Currency', description: 'The Aletheian Guilder' },
			{
				href: '/digital-guilder',
				label: 'Digital Guilder',
				description: 'The Guilder in digital form'
			},
			{ href: '/banknotes', label: 'Banknotes', description: 'The banknote series' },
			{ href: '/issuance', label: 'Issuance', description: 'Issued on the record' }
		]
	},
	{ href: '/statistics', label: 'Statistics' },
	{
		label: 'News & Publications',
		children: [
			{ href: '/news', label: 'News', description: 'Announcements and notices' },
			{ href: '/publications', label: 'Publications', description: 'Documents of the Bank' },
			{ href: '/research', label: 'Research', description: 'The Bank’s research agenda' }
		]
	}
];

export const UTILITY_NAV: NavLink[] = [
	{ href: '/search', label: 'Search' },
	{ href: '/faq', label: 'FAQ' },
	{ href: '/fraud-warning', label: 'Fraud warning' },
	{ href: '/contact', label: 'Contact' }
];

export const FOOTER_NAV: { heading: string; links: NavLink[] }[] = [
	{
		heading: 'The Bank',
		links: [
			{ href: '/about', label: 'About the Bank' },
			{ href: '/about/governance', label: 'Governance' },
			{ href: '/about/international', label: 'International cooperation' },
			{ href: '/explained', label: 'The Bank explained' },
			{ href: '/monetary-policy', label: 'Monetary policy' },
			{ href: '/financial-stability', label: 'Financial stability' },
			{ href: '/payments', label: 'Payments' },
			{ href: '/reserves', label: 'Reserves' }
		]
	},
	{
		heading: 'The Guilder',
		links: [
			{ href: '/currency', label: 'The Aletheian Guilder' },
			{ href: '/digital-guilder', label: 'Digital Guilder' },
			{ href: '/banknotes', label: 'Banknotes' },
			{ href: '/banknotes/reproduction', label: 'Using banknote images' },
			{ href: '/issuance', label: 'Issuance' }
		]
	},
	{
		heading: 'Information',
		links: [
			{ href: '/news', label: 'News' },
			{ href: '/publications', label: 'Publications' },
			{ href: '/statistics', label: 'Statistics' },
			{ href: '/research', label: 'Research' },
			{ href: '/about/careers', label: 'Careers' },
			{ href: '/procurement', label: 'Procurement' },
			{ href: '/faq', label: 'Questions and answers' },
			{ href: '/fraud-warning', label: 'Fraud warning' },
			{ href: '/contact', label: 'Contact' }
		]
	}
];

export const LEGAL_NAV: NavLink[] = [
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/terms', label: 'Copyright and disclaimer' },
	{ href: '/accessibility', label: 'Accessibility' },
	{ href: '/access-to-information', label: 'Access to information' },
	{ href: '/search', label: 'Search' },
	{ href: '/sitemap', label: 'Sitemap' }
];

export const CONTACT: Contact = {
	email: null,
	postal: null,
	enquiryNote:
		'Official contact details for the Bank will be published here. General enquiries can be made through the State of Aletheia.'
};
