<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { isGroup, PRIMARY_NAV, SITE, UTILITY_NAV } from '$lib/content/site';
	import Guilloche from '../motion/Guilloche.svelte';
	import Icon from '../primitives/Icon.svelte';

	/**
	 * Full-height navy sheet in a native <dialog> (focus trap, Esc and inert background come from
	 * showModal). Without JS the trigger is a link to the footer navigation.
	 */
	let dialog = $state<HTMLDialogElement>();
	let trigger = $state<HTMLButtonElement>();

	function open() {
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	function onClose() {
		trigger?.focus();
	}

	afterNavigate(() => {
		if (dialog?.open) dialog.close();
	});

	const current = (href: string) => (page.url.pathname === href ? 'page' : undefined);

	// Flatten for the staggered entrance: each row gets its index.
	const rows = $derived.by(() => {
		const out: { href: string; label: string; child: boolean }[] = [];
		for (const item of PRIMARY_NAV) {
			if (isGroup(item)) {
				for (const c of item.children) out.push({ href: c.href, label: c.label, child: true });
			} else {
				out.push({ href: item.href, label: item.label, child: false });
			}
		}
		return out;
	});
</script>

<button
	bind:this={trigger}
	type="button"
	class="trigger js-only"
	aria-haspopup="dialog"
	aria-controls="mobile-nav"
	onclick={open}
>
	<Icon name="menu" />
	<span>Menu</span>
</button>
<a class="trigger nojs-only" href="#site-footer-nav">
	<Icon name="menu" />
	<span>Menu</span>
</a>

<dialog
	bind:this={dialog}
	id="mobile-nav"
	class="sheet surface-navy"
	aria-label="Site navigation"
	onclose={onClose}
>
	<div class="sheet__inner">
		<div class="sheet__top">
			<p class="t-meta sheet__name">{SITE.name}</p>
			<button type="button" class="close" onclick={close}>
				<Icon name="close" />
				<span>Close</span>
			</button>
		</div>

		<nav aria-label="Main">
			<ul role="list" class="links">
				{#each rows as row, i (row.href)}
					<li class:child={row.child} style:--i={i}>
						<a href={row.href} aria-current={current(row.href)}>{row.label}</a>
					</li>
				{/each}
			</ul>
		</nav>

		<ul role="list" class="utility" style:--i={rows.length}>
			{#each UTILITY_NAV as link (link.href)}
				<li><a href={link.href} aria-current={current(link.href)}>{link.label}</a></li>
			{/each}
			<li>
				<a href={SITE.stateUrl} rel="noopener">
					State of Aletheia <Icon name="arrow-up-right" size={14} />
				</a>
			</li>
		</ul>

		<div class="ornament" aria-hidden="true">
			<Guilloche kind="rosette" seed={21} size={280} layers={3} draw />
		</div>
	</div>
</dialog>

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		min-width: 44px;
		padding-inline: var(--space-3);
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg);
		text-decoration: none;
	}

	@media (min-width: 1024px) {
		.trigger {
			display: none;
		}
	}

	.sheet {
		position: fixed;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		clip-path: inset(0 0 0 0);
		transition:
			clip-path var(--dur-3) var(--ease-in-out-quint),
			overlay var(--dur-3) allow-discrete,
			display var(--dur-3) allow-discrete;
	}

	.sheet:not([open]) {
		clip-path: inset(0 0 100% 0);
	}

	@starting-style {
		.sheet[open] {
			clip-path: inset(0 0 100% 0);
		}
	}

	.sheet::backdrop {
		background: transparent;
	}

	.sheet__inner {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		min-height: 100%;
		padding: var(--space-4) var(--gutter) var(--space-7);
	}

	.sheet__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: var(--hairline) solid var(--line);
		padding-bottom: var(--space-3);
	}

	.sheet__name {
		color: var(--fg-accent);
	}

	.close {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding-inline: var(--space-3);
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
	}

	.links,
	.utility {
		display: grid;
		margin: 0;
	}

	.links li,
	.utility {
		transition:
			opacity var(--dur-3) var(--ease-out-quart),
			transform var(--dur-3) var(--ease-out-quart);
		transition-delay: calc(120ms + var(--i, 0) * var(--stagger));
	}

	@starting-style {
		.sheet[open] .links li,
		.sheet[open] .utility {
			opacity: 0;
			transform: translateY(12px);
		}
	}

	.links a {
		display: block;
		padding-block: var(--space-3);
		font-size: var(--fs-h3);
		font-weight: 350;
		letter-spacing: -0.01em;
		text-decoration: none;
		border-bottom: var(--hairline) solid var(--line);
		min-height: 44px;
	}

	.links .child a {
		padding-left: var(--space-5);
		font-size: var(--fs-lead);
	}

	.links a[aria-current='page'] {
		color: var(--c-gold);
	}

	.utility {
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-2) var(--space-5);
	}

	.utility a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		font-size: var(--fs-meta);
		font-weight: 600;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		text-decoration: none;
	}

	.ornament {
		margin-top: auto;
		width: min(16rem, 60%);
		align-self: flex-end;
		opacity: 0.7;
	}
</style>
