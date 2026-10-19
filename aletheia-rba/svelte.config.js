import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

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
		prerender: {
			handleHttpError: 'fail',
			handleMissingId: 'fail'
		}
	}
};

export default config;
