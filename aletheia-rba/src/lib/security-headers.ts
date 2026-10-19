/**
 * Response headers that a <meta> tag cannot set. Production serves them from vercel.json;
 * hooks.server.ts applies the same set in dev and preview, and a unit test keeps the two equal.
 */
export const SECURITY_HEADERS: Record<string, string> = {
	'Content-Security-Policy': "frame-ancestors 'none'",
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
};
