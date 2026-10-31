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
		id: 'what-is-the-relationship-between-aey-and-aletheiachain',
		group: 'currency',
		question: 'What is the relationship between AEY and AletheiaChain?',
		answer: [
			'AletheiaChain is intended to carry the Guilder in digital form, alongside banknotes.'
		],
		relatedLinks: [{ href: '/currency#forms', label: 'Forms of the Guilder' }]
	},
	{
		id: 'how-will-the-guilder-be-issued',
		group: 'currency',
		question: 'How will the Guilder be issued?',
		answer: [
			'Only by the Reserve Bank of Aletheia, under rules it will publish. Every issue will be recorded in a public register, so that anyone can see how much has been issued and when.'
		],
		relatedLinks: [{ href: '/issuance', label: 'Issuance' }]
	},
	{
		id: 'why-the-name-guilder',
		group: 'currency',
		question: 'Why is it called the Guilder?',
		answer: [
			'The guilder is a historic name for money in Europe, long associated with trade across the North Sea. The Aletheian Guilder carries that name into a new nation, with the code AEY.'
		],
		relatedLinks: [{ href: '/currency', label: 'The Aletheian Guilder' }]
	},
	{
		id: 'what-are-the-banknote-denominations',
		group: 'banknotes',
		question: 'What are the banknote denominations?',
		answer: ['The series is designed in five denominations: 1, 5, 10, 20 and 100 AEY.'],
		relatedLinks: [{ href: '/banknotes', label: 'Banknote designs' }]
	},
	{
		id: 'how-to-tell-notes-apart',
		group: 'banknotes',
		question: 'How can I tell the notes apart?',
		answer: [
			'Each denomination has its own colour and its own portrait: sage green for 1 and 100 AEY, pale blue for 5, violet for 10 and sepia for 20, with the value shown large in the corners.'
		],
		relatedLinks: [{ href: '/banknotes', label: 'Banknote designs' }]
	},
	{
		id: 'can-i-use-banknote-images',
		group: 'banknotes',
		question: 'Can I use images of the banknotes?',
		answer: [
			'Yes, within the reproduction rules: use the images published on this website, do not alter them, and never reproduce a note in a way that could be mistaken for money.'
		],
		relatedLinks: [{ href: '/banknotes/reproduction', label: 'Using banknote images' }]
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
		id: 'is-the-bank-independent',
		group: 'institution',
		question: 'Is the Bank independent?',
		answer: [
			'The Bank is intended to decide monetary policy within its legal mandate, without instruction on individual decisions, and to explain every decision and publish its accounts in return.'
		],
		relatedLinks: [{ href: '/about/governance', label: 'Governance' }]
	},
	{
		id: 'does-the-bank-offer-accounts',
		group: 'institution',
		question: 'Can I open an account with the Bank?',
		answer: [
			'No. Like most central banks, the Bank does not provide accounts, loans or investments to the public. Anyone offering such services in its name should be reported.'
		],
		relatedLinks: [{ href: '/fraud-warning', label: 'Fraud warning' }]
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
