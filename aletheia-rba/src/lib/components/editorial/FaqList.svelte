<script lang="ts">
	import { browser } from '$app/environment';
	import type { Faq } from '$lib/content/schema';

	/**
	 * Native <details> disclosures, one anchor per question. Opening the page at #<id> opens that
	 * question. `claimsAllow` is carried into the HTML for negated answers (ADR 0002).
	 */
	let { items, headingLevel = 3 }: { items: Faq[]; headingLevel?: 2 | 3 } = $props();

	let hash = $state('');

	$effect(() => {
		if (!browser) return;
		const update = () => (hash = decodeURIComponent(location.hash.slice(1)));
		update();
		window.addEventListener('hashchange', update);
		return () => window.removeEventListener('hashchange', update);
	});
</script>

<div class="faq">
	{#each items as item (item.id)}
		<details id={item.id} open={hash === item.id ? true : undefined}>
			<summary>
				<svelte:element this={`h${headingLevel}`} class="q">{item.question}</svelte:element>
				<span class="marker" aria-hidden="true"></span>
			</summary>
			<div class="a" data-claims-allow={item.claimsAllow}>
				{#each item.answer as para, i (i)}
					<p>{para}</p>
				{/each}
				{#if item.relatedLinks.length}
					<ul role="list" class="links">
						{#each item.relatedLinks as link (link.href)}
							<li><a href={link.href}>{link.label}</a></li>
						{/each}
					</ul>
				{/if}
				<a class="permalink t-fine" href="#{item.id}">Link to this answer</a>
			</div>
		</details>
	{/each}
</div>

<style>
	.faq {
		border-top: var(--hairline) solid var(--line-strong);
	}

	details {
		border-bottom: var(--hairline) solid var(--line);
	}

	summary {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-5);
		padding-block: var(--space-5);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.q {
		font-size: var(--fs-h4);
		font-weight: 600;
		line-height: 1.35;
		letter-spacing: 0;
	}

	summary:hover .q {
		text-decoration: underline;
		text-decoration-color: var(--line-strong);
		text-underline-offset: 0.2em;
	}

	/* A plus that turns into a minus: two hairlines, one rotates away. */
	.marker {
		position: relative;
		flex: none;
		width: 18px;
		height: 18px;
		margin-top: 4px;
	}

	.marker::before,
	.marker::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1.5px;
		background: currentColor;
		transition: transform var(--dur-2) var(--ease-out-quart);
	}

	.marker::after {
		transform: rotate(90deg);
	}

	details[open] .marker::after {
		transform: rotate(0deg);
	}

	.a {
		display: grid;
		gap: var(--space-3);
		padding-bottom: var(--space-6);
		max-width: var(--measure);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		margin: 0;
		font-weight: 600;
	}

	.permalink {
		width: fit-content;
	}

	details:target summary .q {
		color: var(--fg-accent);
	}
</style>
