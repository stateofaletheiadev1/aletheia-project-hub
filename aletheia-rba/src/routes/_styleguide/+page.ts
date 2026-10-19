import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

// Development only: never prerendered, and a 404 in any production build.
export const prerender = false;
export const ssr = dev;

export function load() {
	if (!dev) error(404, 'Not found');
}
