import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { siteDefines } from './site-env.js';

export default defineConfig(({ mode }) => ({
	plugins: [sveltekit()],
	define: siteDefines(mode),
	test: {
		include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
		environment: 'node'
	}
}));
