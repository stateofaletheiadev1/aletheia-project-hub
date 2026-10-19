import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/lib/security-headers';

describe('security headers', () => {
	it('vercel.json serves exactly the headers that dev and preview use', () => {
		const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
			headers: { source: string; headers: { key: string; value: string }[] }[];
		};
		const all = config.headers.find((h) => h.source === '/(.*)');
		const served = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
		expect(served).toEqual(SECURITY_HEADERS);
	});
});
