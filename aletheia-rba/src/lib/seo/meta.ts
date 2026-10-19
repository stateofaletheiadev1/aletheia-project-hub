export const SITE_URL: string = __SITE_URL__;
export const DEPLOY_ENV: string = __DEPLOY_ENV__;
export const INDEXABLE = DEPLOY_ENV === 'production';

/** Absolute URL for a site path. The home page keeps its slash; nothing else has one. */
export function canonical(path: string): string {
	if (/^https?:\/\//.test(path)) return path;
	const clean = path === '/' || path === '' ? '/' : path.replace(/\/+$/, '');
	return clean === '/' ? `${SITE_URL}/` : `${SITE_URL}${clean.startsWith('/') ? '' : '/'}${clean}`;
}

/** "Page · Reserve Bank of Aletheia", unless the title already names the Bank. */
export function pageTitle(title: string, suffix = 'Reserve Bank of Aletheia'): string {
	return title.includes(suffix) ? title : `${title} · ${suffix}`;
}
