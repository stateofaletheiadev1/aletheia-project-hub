/**
 * Questions and answers. The page and its FAQPage structured data both render from this list.
 * Keep answers short, confident and true.
 */
import type { z } from 'zod';
import type { Faq } from './schema';

export const faqGroups = {
	currency: 'The Guilder',
	banknotes: 'Banknotes',
	institution: 'The Bank'
} as const;

export const faq: z.input<typeof Faq>[] = [
	{
		id: 'what-is-the-aletheian-guilder',
		group: 'currency',
		question: 'What is the Aletheian Guilder?',
		answer: [
			'The Aletheian Guilder (AEY) is the currency of the Sovereign Covenant State of Aletheia, to be issued by the Reserve Bank of Aletheia.'
		],
		relatedLinks: [{ href: '/currency', label: 'The Aletheian Guilder' }]
	},
	{
		id: 'what-does-fiat-currency-mean',
		group: 'currency',
		question: 'What does fiat currency mean?',
		answer: [
			'A fiat currency is issued by a public institution under law, and its value rests on the rules and institutions that govern it. Most of the world’s currencies work this way, and so is the Guilder intended to.'
		],
		relatedLinks: [{ href: '/monetary-policy', label: 'Monetary policy' }]
	},
	{
		id: 'what-is-the-relationship-between-aey-and-stablechain',
		group: 'currency',
		question: 'What is the relationship between AEY and StableChain?',
		answer: [
			'Aletheia StableChain is intended to carry the Guilder in digital form, alongside banknotes.'
		],
		relatedLinks: [{ href: '/currency#forms', label: 'Forms of the Guilder' }]
	},
	{
		id: 'what-are-the-banknote-denominations',
		group: 'banknotes',
		question: 'What are the banknote denominations?',
		answer: ['The series is designed in five denominations: 1, 5, 10, 20 and 100 AEY.'],
		relatedLinks: [{ href: '/banknotes', label: 'Banknote designs' }]
	},
	{
		id: 'who-will-issue-the-guilder',
		group: 'institution',
		question: 'Who will issue the Guilder?',
		answer: [
			'The Reserve Bank of Aletheia, under rules it will publish, with every issue recorded in a public register.'
		],
		relatedLinks: [{ href: '/issuance', label: 'Issuance' }]
	},
	{
		id: 'where-are-announcements-published',
		group: 'institution',
		question: 'Where will official announcements be published?',
		answer: [
			'On this website, under News and Publications. The Bank does not make announcements through any other channel.'
		],
		relatedLinks: [
			{ href: '/news', label: 'News' },
			{ href: '/publications', label: 'Publications' }
		]
	}
];
