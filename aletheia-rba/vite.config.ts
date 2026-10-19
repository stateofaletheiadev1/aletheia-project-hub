import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { siteDefines } from './site-env.js';

export default defineConfig(({ mode }) => ({
	plugins: [enhancedImages(), sveltekit()],
	define: siteDefines(mode)
}));
