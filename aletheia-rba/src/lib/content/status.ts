/** Status vocabulary: the single source of truth (brief §2.1). */
export const STATUS = {
	proposed: { label: 'Proposed', description: 'Intended but not formally adopted.' },
	adopted: { label: 'Adopted', description: 'Formally decided; not yet implemented.' },
	in_implementation: {
		label: 'In implementation',
		description: 'Adopted and actively being built.'
	},
	operational: { label: 'Operational', description: 'Implemented and functioning.' },
	not_established: {
		label: 'Not yet established',
		description: 'No arrangement exists at present.'
	}
} as const;

export type StatusKey = keyof typeof STATUS;

export const STATUS_KEYS = Object.keys(STATUS) as StatusKey[];
