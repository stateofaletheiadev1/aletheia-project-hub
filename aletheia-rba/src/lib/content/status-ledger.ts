/**
 * The status ledger. Change a status only with evidence; operational reserve, convertibility and
 * issuance items need an evidenceUrl or the build fails.
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
		explanation: 'The proposed national currency.',
		link: '/currency'
	},
	{
		id: 'monetary-framework',
		area: 'monetary-framework',
		capability: 'Monetary policy framework',
		status: 'proposed',
		statusAsOf: AS_OF,
		explanation: 'A fiat framework is the intended direction.',
		link: '/monetary-policy'
	},
	{
		id: 'banknote-designs',
		area: 'currency',
		capability: 'Banknote designs',
		status: 'proposed',
		statusAsOf: AS_OF,
		explanation: 'Designs for five denominations.',
		link: '/banknotes'
	},
	{
		id: 'issuance',
		area: 'issuance',
		capability: 'Issuance',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'Not yet issued.',
		link: '/issuance'
	},
	{
		id: 'reserves-and-exchange',
		area: 'reserves',
		capability: 'Reserves and exchange',
		status: 'not_established',
		statusAsOf: AS_OF,
		explanation: 'To be set out in published policy.',
		link: '/reserves'
	}
];
