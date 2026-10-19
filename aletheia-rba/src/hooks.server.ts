import type { Handle } from '@sveltejs/kit';
import { SECURITY_HEADERS } from '$lib/security-headers';

/** Dev and preview only: the static build is served by the host with vercel.json headers. */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};
