import type { PublicationCategory } from '$lib/content/schema';

export const CATEGORY_LABELS: Record<PublicationCategory, string> = {
	'monetary-policy-statement': 'Monetary policy statement',
	'annual-report': 'Annual report',
	'currency-notice': 'Currency notice',
	'statistical-release': 'Statistical release',
	'institutional-policy': 'Institutional policy',
	'research-paper': 'Research paper',
	consultation: 'Consultation'
};

export function longDate(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function fileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
