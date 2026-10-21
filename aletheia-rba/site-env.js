/**
 * Build-time site settings, shared by vite.config.ts and vitest.config.ts. Read from
 * PUBLIC_SITE_URL and PUBLIC_DEPLOY_ENV (environment or .env files) with safe defaults; injected
 * as constants because every page is prerendered.
 */
import { loadEnv } from 'vite';

/** @param {string} mode */
export function siteDefines(mode) {
	const env = { ...loadEnv(mode, process.cwd(), 'PUBLIC_'), ...process.env };
	const url = (env.PUBLIC_SITE_URL || 'https://rba.aletheiagov.org').replace(/\/+$/, '');
	if (!/^https?:\/\/[^/]+$/.test(url)) {
		throw new Error(
			`PUBLIC_SITE_URL must be an origin such as https://rba.aletheiagov.org (got ${url})`
		);
	}
	return {
		__SITE_URL__: JSON.stringify(url),
		__DEPLOY_ENV__: JSON.stringify(env.PUBLIC_DEPLOY_ENV || 'development')
	};
}
