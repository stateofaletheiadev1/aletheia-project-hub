/**
 * Content schemas (brief §6.1). Every entry is parsed at build time; an invalid entry fails the
 * build. Types are inferred from the schemas so content and code cannot drift.
 */
import { z } from 'zod';
import { STATUS_KEYS, type StatusKey } from './status';

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date, YYYY-MM-DD');
export const Status = z.enum(STATUS_KEYS as [StatusKey, ...StatusKey[]]);

/** A reason recorded with text that claims-lint must let through (ADR 0002). */
const ClaimsAllow = z.string().min(3).optional();

const BanknoteSide = z.object({
	/** Key into the artwork map in banknotes.ts, e.g. "aey-100-front". */
	src: z.string().regex(/^aey-(1|5|10|20|100)-(front|back)$/),
	alt: z.string().min(20)
});

export const Banknote = z.object({
	denomination: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(20), z.literal(100)]),
	code: z.literal('AEY'),
	words: z.string(),
	front: BanknoteSide,
	back: BanknoteSide.nullable(),
	/** Only if observable in the artwork. */
	dominantColour: z.string().nullable(),
	/** Observed design elements only. */
	designNotes: z.array(z.string()).min(1),
	securityFeatures: z.array(
		z.object({
			name: z.string(),
			description: z.string(),
			implementation: z.enum(['concept_only', 'specified', 'physically_implemented'])
		})
	),
	status: Status,
	issuanceStatus: Status,
	statusAsOf: IsoDate
});

export const PublicationCategory = z.enum([
	'monetary-policy-statement',
	'annual-report',
	'currency-notice',
	'statistical-release',
	'institutional-policy',
	'research-paper',
	'consultation'
]);

export const Publication = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/),
	title: z.string(),
	category: PublicationCategory,
	publishedAt: IsoDate,
	updatedAt: IsoDate.optional(),
	summary: z.string().max(320),
	documentUrl: z.url().optional(),
	documentSizeBytes: z.number().int().positive().optional(),
	hasHtmlVersion: z.boolean(),
	status: z.enum(['draft', 'published', 'superseded', 'withdrawn'])
});

export const NewsArticle = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/),
	title: z.string(),
	publishedAt: IsoDate,
	updatedAt: IsoDate.optional(),
	summary: z.string().max(300),
	category: z.enum(['notice', 'announcement', 'statement']),
	ogImage: z.string().optional(),
	draft: z.boolean().default(false)
});

export const StatusArea = z.enum([
	'currency',
	'monetary-framework',
	'issuance',
	'reserves',
	'convertibility',
	'banking',
	'oversight',
	'infrastructure',
	'communication'
]);

/** Areas where an "operational" status must cite evidence (brief §6.2 guardrail). */
export const EVIDENCE_REQUIRED_AREAS: readonly z.infer<typeof StatusArea>[] = [
	'issuance',
	'reserves',
	'convertibility'
];

export const StatusItem = z
	.object({
		id: z.string().regex(/^[a-z0-9-]+$/),
		area: StatusArea,
		capability: z.string(),
		status: Status,
		statusAsOf: IsoDate,
		explanation: z.string(),
		link: z.string().optional(),
		/** Public document proving the status. Required for operational reserve, convertibility and issuance items. */
		evidenceUrl: z.url().optional()
	})
	.refine(
		(item) =>
			!(
				item.status === 'operational' &&
				EVIDENCE_REQUIRED_AREAS.includes(item.area) &&
				!item.evidenceUrl
			),
		{
			message: 'An operational reserve, convertibility or issuance item needs an evidenceUrl',
			path: ['evidenceUrl']
		}
	);

export const Faq = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/),
	group: z.enum(['currency', 'reserves', 'banknotes', 'institution']),
	question: z.string(),
	/** Plain paragraphs; links are given in relatedLinks. */
	answer: z.array(z.string()).min(1),
	relatedLinks: z.array(z.object({ href: z.string(), label: z.string() })).default([]),
	/** Set when the answer must mention a claim in order to negate it (ADR 0002). */
	claimsAllow: ClaimsAllow
});

export const Contact = z.object({
	email: z.email().nullable(),
	postal: z.string().nullable(),
	enquiryNote: z.string()
});

/** A future reserve report (brief §8.7). No figure is ever shown without a source document. */
export const ReserveReport = z.object({
	period: z.object({ from: IsoDate, to: IsoDate }),
	assetClass: z.string(),
	amount: z.number().nonnegative(),
	currency: z.string().regex(/^[A-Z]{3}$/),
	auditor: z.string().nullable(),
	sourceDocument: z.object({ title: z.string(), url: z.url() })
});

/** A future issuance register entry (brief §8.6). */
export const IssuanceRecord = z.object({
	date: IsoDate,
	form: z.enum(['banknote', 'digital']),
	denomination: z.number().positive().nullable(),
	action: z.enum(['authorised', 'issued', 'withdrawn', 'destroyed']),
	amount: z.number().nonnegative(),
	authority: z.string(),
	sourceDocument: z.object({ title: z.string(), url: z.url() })
});

export type Banknote = z.infer<typeof Banknote>;
export type Publication = z.infer<typeof Publication>;
export type PublicationCategory = z.infer<typeof PublicationCategory>;
export type NewsArticle = z.infer<typeof NewsArticle>;
export type StatusItem = z.infer<typeof StatusItem>;
export type Faq = z.infer<typeof Faq>;
export type Contact = z.infer<typeof Contact>;
export type ReserveReport = z.infer<typeof ReserveReport>;
export type IssuanceRecord = z.infer<typeof IssuanceRecord>;
