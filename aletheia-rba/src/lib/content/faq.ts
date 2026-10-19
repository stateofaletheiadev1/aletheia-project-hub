/**
 * Questions and answers (brief §8.10). The page and its FAQPage JSON-LD both render from this
 * list, so they cannot drift. Answers must match the status ledger.
 */
import type { z } from 'zod';
import type { Faq } from './schema';

export const faqGroups = {
	currency: 'The Guilder',
	banknotes: 'Banknotes',
	reserves: 'Reserves and exchange',
	institution: 'The Bank'
} as const;

export const faq: z.input<typeof Faq>[] = [
	{
		id: 'what-is-the-aletheian-guilder',
		group: 'currency',
		question: 'What is the Aletheian Guilder?',
		answer: [
			'The Aletheian Guilder, code AEY, is the proposed national currency of the Sovereign Covenant State of Aletheia. The Reserve Bank of Aletheia is the institution proposed to issue and manage it.',
			'The Guilder is a proposal. It has not been issued in any form.'
		],
		relatedLinks: [
			{ href: '/currency', label: 'The Aletheian Guilder' },
			{ href: '/about#status', label: 'Current status' }
		]
	},
	{
		id: 'what-does-fiat-currency-mean',
		group: 'currency',
		question: 'What does fiat currency mean?',
		answer: [
			'A fiat currency is money whose value does not rest on a promise to exchange it for gold, another currency or any other asset. Most of the world’s currencies, including the euro, work this way.',
			'The preferred direction for the Guilder is a fiat currency. Its credibility would rest on clear rules for how much is issued and why, on sound governance, on regular public reporting, and on an honest account of what exists and what does not. This direction is proposed and has not been formally adopted.'
		],
		relatedLinks: [{ href: '/monetary-policy', label: 'Monetary policy framework' }]
	},
	{
		id: 'has-aey-been-issued',
		group: 'currency',
		question: 'Has AEY been issued?',
		answer: [
			'No. No Aletheian Guilder banknotes have been printed or issued, and no digital Guilders have been issued.',
			'AEY is not legal tender anywhere and has no monetary value today.', // claims-lint-allow: negated FAQ answer
			'Any issuance would first need adopted issuance rules, and would be recorded in a public register on this website.'
		],
		relatedLinks: [{ href: '/issuance', label: 'Issuance framework' }],
		claimsAllow: 'Negated FAQ answer: states what AEY is not.'
	},
	{
		id: 'can-aey-be-exchanged-for-euros',
		group: 'reserves',
		question: 'Can AEY be exchanged for euros?',
		answer: [
			'No. Conversion to euros, or to any other currency, is not offered, and no exchange rate has been set.',
			'A fiat currency can be issued at home without any promise of conversion. Offering conversion would require reserves, banking relationships, a published conversion policy and independent audit, none of which exist today.'
		],
		relatedLinks: [{ href: '/reserves', label: 'Reserves and exchange policy' }]
	},
	{
		id: 'does-aletheia-have-euro-reserves',
		group: 'reserves',
		question: 'Does Aletheia have euro reserves?',
		answer: [
			'No. Aletheia currently holds no euro reserves, and the Reserve Bank holds no foreign reserves of any kind.',
			'If reserves are ever acquired, their composition and amount will be published here with a source document and an auditor’s report.'
		],
		relatedLinks: [{ href: '/reserves', label: 'Reserves and exchange policy' }]
	},
	{
		id: 'what-would-international-acceptance-require',
		group: 'reserves',
		question: 'What would be required for international acceptance?',
		answer: [
			'Acceptance of the Guilder beyond Aletheia would depend on decisions by others, not on statements by the Bank. It would require, at least, a legal basis for the Bank and the currency, governance that others can examine, a currency in actual use, banking and payment relationships abroad, and a record of regular, independently audited reporting.',
			'None of these exist yet. The Bank will report progress on each of them in its status ledger.'
		],
		relatedLinks: [
			{ href: '/reserves#preconditions', label: 'Preconditions for convertibility' },
			{ href: '/about#status', label: 'Current status' }
		]
	},
	{
		id: 'what-are-the-banknote-denominations',
		group: 'banknotes',
		question: 'What are the banknote denominations?',
		answer: [
			'Designs exist for five denominations: 1, 5, 10, 20 and 100 AEY. They are proposed designs. No notes have been printed or issued.'
		],
		relatedLinks: [{ href: '/banknotes', label: 'Banknote designs' }]
	},
	{
		id: 'why-do-the-designs-say-specimen',
		group: 'banknotes',
		question: 'Why do the banknote designs say “specimen”?',
		answer: [
			'The designs are concepts, and some of the text drawn on them describes arrangements that do not exist: an issuer’s name, places and dates of issue, signatures, serial numbers and a statement about reserve backing. These are part of the artwork, not statements by the Bank.',
			'Every published image therefore carries a specimen overprint. The Bank holds no reserves, and no note has been issued.'
		],
		relatedLinks: [{ href: '/banknotes', label: 'Banknote designs' }]
	},
	{
		id: 'what-is-the-relationship-between-aey-and-stablechain',
		group: 'currency',
		question: 'What is the relationship between AEY and StableChain?',
		answer: [
			'Aletheia StableChain is the digital ledger being built for Aletheia. It is intended to serve as the settlement ledger for the Guilder and for the public record, alongside banknotes as the physical form.',
			'StableChain is in development and is not in public operation. No Guilders have been issued on it.'
		],
		relatedLinks: [{ href: '/currency#forms', label: 'Physical and digital forms' }]
	},
	{
		id: 'is-the-reserve-bank-established',
		group: 'institution',
		question: 'Is the Reserve Bank of Aletheia an established central bank?',
		answer: [
			'No. The Reserve Bank of Aletheia is a proposed institution of the Sovereign Covenant State of Aletheia. Its mandate, governance and legal basis are being prepared and have not been adopted.',
			'This website sets out what is intended, what exists and what does not, and is updated as that changes.'
		],
		relatedLinks: [{ href: '/about', label: 'About the Bank' }]
	},
	{
		id: 'how-will-changes-be-announced',
		group: 'institution',
		question: 'How will changes be announced?',
		answer: [
			'Every change of status is dated in the status ledger. Decisions, notices and reports will be published in Publications and in News, each with a permanent address and date.'
		],
		relatedLinks: [
			{ href: '/publications', label: 'Publications' },
			{ href: '/news', label: 'News and notices' }
		]
	}
];
