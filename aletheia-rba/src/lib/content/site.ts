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
			{ href: '/about/mission', label: 'Mission and values', description: 'What we stand for' },
			{ href: '/about/strategy', label: 'Strategic priorities', description: 'Building the Bank' },
			{ href: '/about/governance', label: 'Governance', description: 'Board, committees and law' },
			{
				href: '/about/organisation',
				label: 'Organisation',
				description: 'How the Bank is organised'
			},
			{ href: '/about/integrity', label: 'Ethics and integrity', description: 'Conduct and audit' },
			{
				href: '/about/international',
				label: 'International cooperation',
				description: 'Working with other institutions'
			},
			{ href: '/about/seal', label: 'The seal', description: 'The Bank’s emblem' },
			{ href: '/about/careers', label: 'Careers', description: 'Working at the Bank' }
		]
	},
	{ href: '/monetary-policy', label: 'Monetary Policy' },
	{
		label: 'Financial System',
		children: [
			{
				href: '/financial-stability',
				label: 'Financial stability',
				description: 'A sound financial system'
			},
			{ href: '/payments', label: 'Payments', description: 'Settlement and infrastructure' },
			{ href: '/reserves', label: 'Reserves', description: 'Reserve and exchange policy' },
			{
				href: '/financial-inclusion',
				label: 'Financial inclusion',
				description: 'A system for everyone'
			},
			{ href: '/innovation', label: 'Innovation', description: 'Modern foundations' },
			{ href: '/sustainability', label: 'Sustainability', description: 'A maritime nation' }
		]
	},
	{
		label: 'The Guilder',
		children: [
			{ href: '/currency', label: 'Currency', description: 'The Aletheian Guilder' },
			{ href: '/banknotes', label: 'Banknotes', description: 'The banknote series' },
			{ href: '/banknotes/design', label: 'Design themes', description: 'The story of the series' },
			{
				href: '/digital-guilder',
				label: 'Digital Guilder',
				description: 'The Guilder in digital form'
			},
			{ href: '/issuance', label: 'Issuance', description: 'Issued on the record' },
			{
				href: '/banknotes/reproduction',
				label: 'Using banknote images',
				description: 'Reproduction rules'
			}
		]
	},
	{
		label: 'Learn',
		children: [
			{ href: '/learn', label: 'Money and you', description: 'Practical guides' },
			{ href: '/explained', label: 'The Bank explained', description: 'Central banking in brief' },
			{ href: '/faq', label: 'Questions and answers', description: 'Common questions' }
		]
	},
	{
		label: 'News & Publications',
		children: [
			{ href: '/news', label: 'News', description: 'Announcements and notices' },
			{ href: '/publications', label: 'Publications', description: 'Documents of the Bank' },
			{ href: '/research', label: 'Research', description: 'The Bank’s research agenda' },
			{ href: '/statistics', label: 'Statistics', description: 'Monetary and financial data' },
			{ href: '/media', label: 'Media centre', description: 'Press and official marks' }
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
			{ href: '/about/mission', label: 'Mission and values' },
			{ href: '/about/governance', label: 'Governance' },
			{ href: '/about/organisation', label: 'Organisation' },
			{ href: '/about/integrity', label: 'Ethics and integrity' },
			{ href: '/about/careers', label: 'Careers' }
		]
	},
	{
		heading: 'Policy and the system',
		links: [
			{ href: '/monetary-policy', label: 'Monetary policy' },
			{ href: '/financial-stability', label: 'Financial stability' },
			{ href: '/payments', label: 'Payments' },
			{ href: '/reserves', label: 'Reserves' },
			{ href: '/financial-inclusion', label: 'Financial inclusion' },
			{ href: '/innovation', label: 'Innovation' }
		]
	},
	{
		heading: 'The Guilder',
		links: [
			{ href: '/currency', label: 'The Aletheian Guilder' },
			{ href: '/banknotes', label: 'Banknotes' },
			{ href: '/digital-guilder', label: 'Digital Guilder' },
			{ href: '/issuance', label: 'Issuance' },
			{ href: '/learn', label: 'Money and you' }
		]
	},
	{
		heading: 'Information',
		links: [
			{ href: '/news', label: 'News' },
			{ href: '/publications', label: 'Publications' },
			{ href: '/statistics', label: 'Statistics' },
			{ href: '/media', label: 'Media centre' },
			{ href: '/procurement', label: 'Procurement' },
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
	email: 'info@stateofaletheia.org',
	postal: null,
	enquiryNote:
		'Enquiries about the Bank are answered by the founding team of the Sovereign Covenant State of Aletheia. Journalists can write to press@stateofaletheia.org, and security reports go to security@aletheiagov.org. The Bank never asks for payment, passwords or identity documents by email.'
};
