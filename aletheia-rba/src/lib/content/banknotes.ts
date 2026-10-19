/**
 * The five proposed banknote designs. Design notes describe only what is visible in the artwork
 * (reviewed 2026-10-19). Security features are design concepts: nothing has been printed.
 * Artwork files are mapped in banknote-artwork.ts.
 */
import type { z } from 'zod';
import type { Banknote } from './schema';

const AS_OF = '2026-10-19';

/** The features the designs depict. None is physically implemented. */
const conceptFeatures: z.input<typeof Banknote>['securityFeatures'] = [
	{
		name: 'Latent image',
		description:
			'A numeral or emblem that would appear only when the note is tilted or held to the light.',
		implementation: 'concept_only'
	},
	{
		name: 'Microprint and guilloché',
		description:
			'Fine text and engine-turned linework that consumer scanners and printers reproduce poorly.',
		implementation: 'concept_only'
	},
	{
		name: 'Serial numbers',
		description: 'A serial number printed in two places on each note.',
		implementation: 'concept_only'
	}
];

export const banknotes: z.input<typeof Banknote>[] = [
	{
		denomination: 1,
		code: 'AEY',
		words: 'One Aletheian Guilder',
		front: {
			src: 'aey-1-front',
			alt: 'Front of the proposed 1 AEY note in sage green: an engraved portrait of St Benedict of Nursia beside the hexagonal State Seal of Aletheia, an open book and wind turbines at sea, overprinted SPECIMEN.'
		},
		back: {
			src: 'aey-1-back',
			alt: 'Back of the proposed 1 AEY note in sage green: a sailing ship and offshore wind turbines beside a hexagonal harbour, above a laurel-wreathed seal, overprinted SPECIMEN.'
		},
		dominantColour: 'Sage green',
		designNotes: [
			'Front: portrait of St Benedict of Nursia.',
			'Front: the State Seal of Aletheia, an open book with Latin inscriptions, and wind turbines on the sea.',
			'Front: a window showing the numeral 1 as a latent-image concept.',
			'Back: a sailing ship, offshore wind turbines and a hexagonal harbour.',
			'Back: a seal reading Veritas · Iustitia · Foedus · Progressus within a laurel wreath.'
		],
		securityFeatures: conceptFeatures,
		status: 'proposed',
		issuanceStatus: 'not_established',
		statusAsOf: AS_OF
	},
	{
		denomination: 5,
		code: 'AEY',
		words: 'Five Aletheian Guilders',
		front: {
			src: 'aey-5-front',
			alt: 'Front of the proposed 5 AEY note in pale blue: an engraved portrait of Nikola Tesla against lightning linework, with the State Seal and an open book, overprinted SPECIMEN.'
		},
		back: {
			src: 'aey-5-back',
			alt: 'Back of the proposed 5 AEY note in pale blue: offshore wind turbines and an energy island beneath the crowned crest of Benedict State, overprinted SPECIMEN.'
		},
		dominantColour: 'Pale blue',
		designNotes: [
			'Front: portrait of Nikola Tesla, captioned as inventor and electromagnetic pioneer.',
			'Front: lightning-field engraving, electrical apparatus, the State Seal and an open book captioned Lux et Veritas.',
			'Back: offshore wind turbines and an energy island.',
			'Back: the crowned crest of Benedict State within a laurel wreath.'
		],
		securityFeatures: conceptFeatures,
		status: 'proposed',
		issuanceStatus: 'not_established',
		statusAsOf: AS_OF
	},
	{
		denomination: 10,
		code: 'AEY',
		words: 'Ten Aletheian Guilders',
		front: {
			src: 'aey-10-front',
			alt: 'Front of the proposed 10 AEY note in violet: an engraved civic portrait in an oval frame, a ledger lattice diagram and the crest of Antioch, overprinted SPECIMEN.'
		},
		back: {
			src: 'aey-10-back',
			alt: 'Back of the proposed 10 AEY note in violet: the concentric hexagonal plan of a city with a domed centre, a state seal and an open book, overprinted SPECIMEN.'
		},
		dominantColour: 'Violet',
		designNotes: [
			'Front: an engraved civic portrait in an oval frame. The sitter is not named on the note.',
			'Front: a lattice diagram labelled StableChain DAG Lattice, a formula, and the crest of Antioch with a ship and an open book.',
			'Back: a concentric hexagonal city plan with a domed centre, framed by mountains.',
			'Back: the Aletheian Covenant State Seal above an open book inscribed Open Public Ledger and Cryptographic Proof.'
		],
		securityFeatures: conceptFeatures,
		status: 'proposed',
		issuanceStatus: 'not_established',
		statusAsOf: AS_OF
	},
	{
		denomination: 20,
		code: 'AEY',
		words: 'Twenty Aletheian Guilders',
		front: {
			src: 'aey-20-front',
			alt: 'Front of the proposed 20 AEY note in sepia: an engraved portrait of St Augustine holding De Civitate Dei before a domed university campus, overprinted SPECIMEN.'
		},
		back: {
			src: 'aey-20-back',
			alt: 'Back of the proposed 20 AEY note in sepia: a tall civic building and a radio telescope beneath a round seal, flanked by two shields, overprinted SPECIMEN.'
		},
		dominantColour: 'Sepia',
		designNotes: [
			'Front: portrait of St Augustine holding a book titled De Civitate Dei.',
			'Front: a domed campus captioned National University and Medical Campus of Augustine State, and a shield bearing a book, lightning, a ship and a cross.',
			'Back: a tall civic building, a radio telescope and a round seal with an eagle.',
			'Back: shields captioned St. Barbara State Aerospace & Research Center and National Defense & Integrity Office.'
		],
		securityFeatures: conceptFeatures,
		status: 'proposed',
		issuanceStatus: 'not_established',
		statusAsOf: AS_OF
	},
	{
		denomination: 100,
		code: 'AEY',
		words: 'One Hundred Aletheian Guilders',
		front: {
			src: 'aey-100-front',
			alt: 'Front of the proposed 100 AEY note in sage green: an engraved portrait of St Brendan of Clonfert holding a ship, above a planned city with a domed hall, overprinted SPECIMEN.'
		},
		back: {
			src: 'aey-100-back',
			alt: 'Back of the proposed 100 AEY note in sage green: emblems of four states, a tower, a temple with a book, wheat and a sailing ship, beneath a hexagonal lattice, overprinted SPECIMEN.'
		},
		dominantColour: 'Sage green',
		designNotes: [
			'Front: portrait of St Brendan of Clonfert, captioned as navigator of the North Sea, holding a ship.',
			'Front: a planned city with a domed hall, wind turbines, a hexagonal seal and an open book with Latin inscriptions.',
			'Back: emblems of St. Barbara State, Augustine State, Benedict State and St. Brendan State.',
			'Back: a hexagonal lattice and a central seal reading Veritas in Foedere.'
		],
		securityFeatures: conceptFeatures,
		status: 'proposed',
		issuanceStatus: 'not_established',
		statusAsOf: AS_OF
	}
];
