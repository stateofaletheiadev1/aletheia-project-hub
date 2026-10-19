/**
 * Adds `is-revealed` when an element first scrolls into view. Pair it with `data-reveal` (fade and
 * rise) or `data-draw` (line-drawn SVG); the CSS in motion.css only hides content when JS runs and
 * motion is allowed, so without either the content is simply there.
 */
import type { Action } from 'svelte/action';

const SAFETY_MS = 2500;
const pending = new Set<Element>();
let observer: IntersectionObserver | null = null;
let safety: ReturnType<typeof setTimeout> | null = null;

function show(el: Element) {
	el.classList.add('is-revealed');
	pending.delete(el);
	observer?.unobserve(el);
}

function getObserver(): IntersectionObserver {
	observer ??= new IntersectionObserver(
		(entries) => {
			for (const entry of entries) if (entry.isIntersecting) show(entry.target);
		},
		{ rootMargin: '0px 0px -10% 0px' }
	);
	return observer;
}

function armSafety() {
	if (safety) return;
	// If the observer never fires (old engines, odd layouts), reveal everything anyway.
	safety = setTimeout(() => {
		for (const el of [...pending]) show(el);
		safety = null;
	}, SAFETY_MS);
}

export const reveal: Action<HTMLElement | SVGElement, number | undefined> = (node, index) => {
	if (index !== undefined) node.style.setProperty('--i', String(index));
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduced || typeof IntersectionObserver === 'undefined') {
		node.classList.add('is-revealed');
		return;
	}
	pending.add(node);
	getObserver().observe(node);
	armSafety();
	return {
		update(next) {
			if (next !== undefined) node.style.setProperty('--i', String(next));
		},
		destroy() {
			pending.delete(node);
			observer?.unobserve(node);
		}
	};
};
