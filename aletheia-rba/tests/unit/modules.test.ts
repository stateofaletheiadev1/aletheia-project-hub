import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import IssuanceRegister from '../../src/lib/components/institutional/IssuanceRegister.svelte';
import ReserveReports from '../../src/lib/components/institutional/ReserveReports.svelte';
import { serializeJsonLd } from '../../src/lib/seo/jsonld';
import { canonical } from '../../src/lib/seo/meta';

describe('reserve reports module', () => {
	it('renders the empty state when there are no reports', () => {
		const { body } = render(ReserveReports, { props: { reports: [] } });
		expect(body).toContain('data-testid="reserve-reports-empty"');
		expect(body).not.toContain('<table');
	});

	it('renders a table, with the source document, when a report exists', () => {
		const { body } = render(ReserveReports, {
			props: {
				reports: [
					{
						period: { from: '2027-01-01', to: '2027-03-31' },
						assetClass: 'Test asset',
						amount: 1,
						currency: 'EUR',
						auditor: null,
						sourceDocument: { title: 'Test report', url: 'https://example.org/r.pdf' }
					}
				]
			}
		});
		expect(body).toContain('data-testid="reserve-reports-table"');
		expect(body).toContain('https://example.org/r.pdf');
	});
});

describe('issuance register', () => {
	it('renders its empty state when there are no records', () => {
		const { body } = render(IssuanceRegister, { props: { records: [] } });
		expect(body).toContain('data-testid="issuance-register-empty"');
	});
});

describe('seo', () => {
	it('escapes < in JSON-LD so content cannot close the script element', () => {
		expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('<');
	});

	it('builds canonical URLs without trailing slashes, except home', () => {
		expect(canonical('/')).toBe('https://rbaletheia.org/');
		expect(canonical('/about/')).toBe('https://rbaletheia.org/about');
		expect(canonical('/faq')).toBe('https://rbaletheia.org/faq');
	});
});
