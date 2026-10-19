/**
 * The status ledger (brief §6.2). Change a status only with evidence; operational reserve,
 * convertibility and issuance items need an evidenceUrl or the build fails.
 */
import type { z } from 'zod';
import type { StatusItem } from './schema';

const AS_OF = '2026-10-19';

export const statusLedger: z.input<typeof StatusItem>[] = [
	{
		id: 'aletheian-guilder',
		area: 'currency',
		capability: 'The Aletheian Guilder (AEY)',
		status: 'proposed',
		statusAsOf: AS_OF,
		explanation:
			'The proposed national currency of the Sovereign Covenant State of Aletheia. It has not been issued.',
		link: '/currency'
	},
	{
		id: 'fiat-framework',
		area: 'monetary-framework',
		capability: 'Fiat monetary framework',
		status: 'proposed',
		statusAsOf: AS_OF,
		explanation:
			'The preferred direction is a fiat currency. No framework has been formally adopted.',
		link: '/monetary-policy'
	},
	{
		id: 'banknote-designs',
		area: 'currency',
		capability: 'Banknote designs, 1 to 100 AEY',
		status: 'proposed',
		statusAsOf: AS_OF,
		explanation: 'Designs exist for five denominations. They are design concepts, not notes.',
		link: '/banknotes'
	},
	{
		id: 'banknote-issuance',
		area: 'issuance',
		capability: 'Banknote issuance',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'No banknotes have been printed or issued.',
		link: '/issuance'
	},
	{
		id: 'issuance-rules',
		area: 'issuance',
		capability: 'Issuance governance rules',
		status: 'proposed',
		statusAsOf: AS_OF,
		explanation:
			'The rules that would authorise, record and publish any issuance are being developed. None have been adopted.',
		link: '/issuance'
	},
	{
		id: 'foreign-reserves',
		area: 'reserves',
		capability: 'Foreign and euro reserves',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'Aletheia holds no euro reserves, and the Bank holds no foreign reserves.',
		link: '/reserves'
	},
	{
		id: 'euro-conversion',
		area: 'convertibility',
		capability: 'Conversion to euros',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'Conversion is not offered, and no exchange rate has been set.',
		link: '/reserves'
	},
	{
		id: 'correspondent-banking',
		area: 'banking',
		capability: 'Correspondent banking relationships',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'The Bank has no banking or custody relationships.',
		link: '/reserves'
	},
	{
		id: 'independent-audit',
		area: 'oversight',
		capability: 'Independent audit of issuance',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'No auditor has been appointed. There is nothing yet to audit.',
		link: '/issuance'
	},
	{
		id: 'stablechain',
		area: 'infrastructure',
		capability: 'Aletheia StableChain',
		status: 'in_implementation',
		statusAsOf: AS_OF,
		explanation:
			'The intended settlement ledger for the Guilder. The software is being built; it is not in public operation.',
		link: '/currency#forms'
	},
	{
		id: 'public-website',
		area: 'communication',
		capability: 'Public website',
		status: 'operational',
		statusAsOf: AS_OF,
		explanation: 'This website, where the Bank publishes its status and documents.'
	}
];
