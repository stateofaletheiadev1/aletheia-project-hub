/** Site identity, navigation and contact. Contact fields stay null until real channels exist. */
import type { Contact } from './schema';

export const SITE = {
	name: 'Reserve Bank of Aletheia',
	shortName: 'RBA',
	state: 'Sovereign Covenant State of Aletheia',
	currency: { name: 'Aletheian Guilder', plural: 'Aletheian Guilders', code: 'AEY' },
	description:
		'The Reserve Bank of Aletheia is the proposed monetary institution of the Sovereign Covenant State of Aletheia and of its proposed currency, the Aletheian Guilder (AEY).',
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
	{ href: '/about', label: 'About' },
	{ href: '/monetary-policy', label: 'Monetary Policy' },
	{
		label: 'The Guilder',
		children: [
			{
				href: '/currency',
				label: 'Currency',
				description: 'The Aletheian Guilder and its current status'
			},
			{ href: '/banknotes', label: 'Banknotes', description: 'Five proposed banknote designs' },
			{ href: '/issuance', label: 'Issuance', description: 'How currency would be issued' }
		]
	},
	{ href: '/reserves', label: 'Reserves' },
	{ href: '/publications', label: 'Publications' },
	{ href: '/news', label: 'News' }
];

export const UTILITY_NAV: NavLink[] = [
	{ href: '/faq', label: 'FAQ' },
	{ href: '/contact', label: 'Contact' }
];

export const FOOTER_NAV: { heading: string; links: NavLink[] }[] = [
	{
		heading: 'The Bank',
		links: [
			{ href: '/about', label: 'About the Bank' },
			{ href: '/about#status', label: 'Current status' },
			{ href: '/monetary-policy', label: 'Monetary policy' },
			{ href: '/reserves', label: 'Reserves and exchange' }
		]
	},
	{
		heading: 'The Guilder',
		links: [
			{ href: '/currency', label: 'The Aletheian Guilder' },
			{ href: '/banknotes', label: 'Banknote designs' },
			{ href: '/issuance', label: 'Issuance framework' },
			{ href: '/faq', label: 'Questions and answers' }
		]
	},
	{
		heading: 'Publications',
		links: [
			{ href: '/publications', label: 'Publications' },
			{ href: '/news', label: 'News and notices' },
			{ href: '/contact', label: 'Contact' }
		]
	}
];

export const LEGAL_NAV: NavLink[] = [
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/terms', label: 'Terms of use' },
	{ href: '/accessibility', label: 'Accessibility' }
];

export const CONTACT: Contact = {
	email: null,
	postal: null,
	enquiryNote:
		'Official enquiry channels for the Reserve Bank of Aletheia are being established. Until they are published here, general enquiries about Aletheia can be made through the State of Aletheia website.'
};
