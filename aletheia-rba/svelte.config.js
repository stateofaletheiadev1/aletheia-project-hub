import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The one inline script in app.html (it swaps the no-js class). Its hash is computed from the
// file, so the policy cannot go stale when the script changes.
const appHtml = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
const inline = /<script>([\s\S]*?)<\/script>/.exec(appHtml)?.[1] ?? '';
const appScriptHash = `sha256-${createHash('sha256').update(inline).digest('base64')}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Markdown is used for publications and news; frontmatter is validated in src/lib/content.
	extensions: ['.svelte', '.md'],
	preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'] })],
	compilerOptions: {
		runes: true
	},
	kit: {
		// Every route prerenders; the output is plain files any static host can serve.
		// 404.html is emitted for hosts that serve it for unknown paths.
		adapter: adapter({ fallback: '404.html', strict: true }),
		// Prerendered pages carry this policy in a <meta> tag, with hashes of SvelteKit's own
		// inline scripts. Headers that cannot be set from a meta tag are in vercel.json.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', appScriptHash],
				// Svelte style: directives and transitions set inline style attributes.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		},
		prerender: {
			// Not linked from any page, so named here for the crawler.
			entries: ['*', '/sitemap.xml', '/robots.txt', '/news.xml'],
			handleHttpError: 'fail',
			handleMissingId: 'fail',
			// Detail routes for publications and news have no pages until a document is published.
			// Any other route that is not prerendered still fails the build.
			handleUnseenRoutes: ({ routes, message }) => {
				const allowed = new Set(['/publications/[slug]', '/news/[slug]']);
				if (routes.some((r) => !allowed.has(r))) throw new Error(message);
			}
		}
	}
};

export default config;
