/**
 * The five proposed banknote designs. Descriptions are brief and describe only what is visible.
 * Artwork files are mapped in banknote-artwork.ts.
 */
import type { z } from 'zod';
import type { Banknote } from './schema';

const AS_OF = '2026-10-19';

const note = (
	denomination: 1 | 5 | 10 | 20 | 100,
	words: string,
	colour: string,
	front: string,
	back: string
): z.input<typeof Banknote> => ({
	denomination,
	code: 'AEY',
	words,
	front: {
		src: `aey-${denomination}-front`,
		alt: `Front of the ${denomination} AEY note design in ${colour.toLowerCase()}: ${front}.`
	},
	back: {
		src: `aey-${denomination}-back`,
		alt: `Back of the ${denomination} AEY note design in ${colour.toLowerCase()}: ${back}.`
	},
	dominantColour: colour,
	designNotes: [`Front: ${front}.`, `Back: ${back}.`],
	securityFeatures: [],
	status: 'proposed',
	issuanceStatus: 'not_established',
	statusAsOf: AS_OF
});

export const banknotes: z.input<typeof Banknote>[] = [
	note(
		1,
		'One Aletheian Guilder',
		'Sage green',
		'a portrait of St Benedict of Nursia',
		'a sailing ship at sea'
	),
	note(5, 'Five Aletheian Guilders', 'Pale blue', 'a portrait of Nikola Tesla', 'offshore wind'),
	note(10, 'Ten Aletheian Guilders', 'Violet', 'an engraved civic portrait', 'a city plan'),
	note(20, 'Twenty Aletheian Guilders', 'Sepia', 'a portrait of St Augustine', 'a civic building'),
	note(
		100,
		'One Hundred Aletheian Guilders',
		'Sage green',
		'a portrait of St Brendan of Clonfert',
		'the emblems of the four states'
	)
];
