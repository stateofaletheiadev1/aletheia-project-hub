<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { isGroup, PRIMARY_NAV, SITE, UTILITY_NAV } from '$lib/content/site';
	import BankSeal from '../brand/BankSeal.svelte';
	import Icon from '../primitives/Icon.svelte';
	import MobileNav from './MobileNav.svelte';

	/**
	 * Transparent over the navy page head; a solid parchment bar with a hairline once the page
	 * scrolls (an IntersectionObserver sentinel, no scroll listeners). The submenu is a disclosure:
	 * a button with aria-expanded, closed by Esc, outside click and navigation.
	 */
	let sentinel = $state<HTMLElement>();
	let solid = $state(false);
	let openGroup = $state<string | null>(null);
	let navEl = $state<HTMLElement>();

	$effect(() => {
		if (!sentinel || typeof IntersectionObserver === 'undefined') return;
		const io = new IntersectionObserver(([entry]) => {
			solid = !(entry?.isIntersecting ?? true);
		});
		io.observe(sentinel);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!openGroup) return;
		const label = openGroup;
		const onPointer = (e: PointerEvent) => {
			if (navEl && !navEl.contains(e.target as Node)) openGroup = null;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			openGroup = null;
			navEl?.querySelector<HTMLButtonElement>(`button[data-group="${label}"]`)?.focus();
		};
		const onFocus = (e: FocusEvent) => {
			const wrap = navEl?.querySelector(`[data-group-wrap="${label}"]`);
			if (wrap && !wrap.contains(e.target as Node)) openGroup = null;
		};
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('keydown', onKey);
		document.addEventListener('focusin', onFocus);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('focusin', onFocus);
		};
	});

	afterNavigate(() => {
		openGroup = null;
	});

	const path = $derived(page.url.pathname);
	const current = (href: string) => (path === href ? 'page' : undefined);
	const within = (href: string) => path === href || path.startsWith(`${href}/`);
	const slug = (label: string) => label.toLowerCase().replace(/[^a-z]+/g, '-');
</script>

<div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>

<header class="masthead" class:is-solid={solid}>
	<div class="utility">
		<div class="container utility__row">
			<ul role="list" class="utility__list">
				<li><a href="/currency" aria-current={current('/currency')}>Aletheian Guilder · AEY</a></li>
			</ul>
			<ul role="list" class="utility__list">
				{#each UTILITY_NAV as link (link.href)}
					<li><a href={link.href} aria-current={current(link.href)}>{link.label}</a></li>
				{/each}
				<li>
					<a href={SITE.stateUrl} rel="noopener"
						>State of Aletheia <Icon name="arrow-up-right" size={12} /></a
					>
				</li>
			</ul>
		</div>
	</div>

	<div class="container bar">
		<a class="brand" href="/" aria-current={current('/')}>
			<BankSeal variant="mark" size={44} />
			<span class="wordmark">
				<span class="wordmark__name">{SITE.name}</span>
				<span class="wordmark__sub">{SITE.state}</span>
			</span>
		</a>

		<nav aria-label="Main" class="primary" bind:this={navEl}>
			<ul role="list" class="primary__list">
				{#each PRIMARY_NAV as item, index (item.label)}
					{#if isGroup(item)}
						{@const active = item.children.some((c) => within(c.href))}
						{@const isOpen = openGroup === item.label}
						<li class="group" data-group-wrap={item.label}>
							<button
								type="button"
								class="primary__link group__button js-only"
								class:is-active={active}
								data-group={item.label}
								aria-expanded={isOpen}
								aria-controls="nav-{slug(item.label)}"
								onclick={() => (openGroup = isOpen ? null : item.label)}
							>
								{item.label}
								<Icon name="chevron-down" size={14} class="chev" />
							</button>
							<a
								class="primary__link nojs-only"
								class:is-active={active}
								href={item.children[0]?.href}>{item.label}</a
							>
							<div
								id="nav-{slug(item.label)}"
								class="panel surface-parchment"
								class:panel--end={index >= PRIMARY_NAV.length / 2}
								hidden={!isOpen}
							>
								<ul role="list">
									{#each item.children as child (child.href)}
										<li>
											<a href={child.href} aria-current={current(child.href)}>
												<span class="panel__label">{child.label}</span>
												{#if child.description}
													<span class="panel__desc">{child.description}</span>
												{/if}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						</li>
					{:else}
						<li>
							<a
								class="primary__link"
								class:is-active={within(item.href)}
								href={item.href}
								aria-current={current(item.href)}>{item.label}</a
							>
						</li>
					{/if}
				{/each}
			</ul>
		</nav>

		<MobileNav />
	</div>
</header>

<style>
	.sentinel {
		position: absolute;
		top: 0;
		left: 0;
		width: 1px;
		height: 48px;
		pointer-events: none;
	}

	.masthead {
		position: fixed;
		inset: 0 0 auto;
		z-index: var(--z-masthead);
		view-transition-name: masthead;
		/* Over the navy page head: inverse colours on a transparent ground. */
		--fg: var(--c-parchment);
		--fg-muted: var(--c-parchment-400);
		--fg-accent: var(--c-gold);
		--line: var(--rule-inverse);
		--line-strong: color-mix(in oklab, var(--c-parchment) 45%, transparent);
		--focus-ring: var(--c-gold);
		color: var(--fg);
		background-color: transparent;
		border-bottom: var(--hairline) solid transparent;
		transition:
			transform var(--dur-3) var(--ease-out-quart),
			background-color var(--dur-2) var(--ease-out-quart),
			border-color var(--dur-2) var(--ease-out-quart),
			color var(--dur-2) var(--ease-out-quart);
	}

	.masthead.is-solid {
		--fg: var(--c-ink);
		--fg-muted: var(--c-ink-muted);
		--fg-accent: var(--c-gold-ink);
		--line: var(--rule);
		--line-strong: var(--rule-strong);
		--focus-ring: var(--c-navy);
		background-color: var(--c-parchment);
		border-bottom-color: var(--rule-strong);
	}

	@media (min-width: 1024px) {
		.masthead.is-solid {
			transform: translateY(calc(-1 * var(--utility-h)));
		}
	}

	/* Utility strip: desktop only */
	.utility {
		display: none;
		height: var(--utility-h);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 1024px) {
		.utility {
			display: block;
		}
	}

	.utility__row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 100%;
	}

	.utility__list {
		display: flex;
		gap: var(--space-5);
		margin: 0;
	}

	.utility a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--fs-fine);
		font-weight: 600;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg-muted);
		text-decoration: none;
		padding-block: var(--space-2);
	}

	.utility a:hover,
	.utility a[aria-current='page'] {
		color: var(--fg);
	}

	/* Main bar */
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		height: var(--bar-h);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		text-decoration: none;
		color: var(--fg);
		min-height: 44px;
	}

	.brand {
		--seal-ground: transparent;
	}

	.wordmark {
		display: grid;
		line-height: 1.15;
	}

	.wordmark__name {
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: 0.01em;
	}

	.wordmark__sub {
		font-size: var(--fs-fine);
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
	}

	@media (max-width: 479px) {
		.wordmark__sub {
			display: none;
		}
	}

	.primary {
		display: none;
	}

	@media (min-width: 1024px) {
		.primary {
			display: block;
		}
	}

	.primary__list {
		display: flex;
		align-items: center;
		gap: clamp(var(--space-3), 1.2vw, var(--space-6));
		margin: 0;
	}

	.primary__link {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 44px;
		font-size: 0.9375rem;
		font-weight: 550;
		color: var(--fg);
		text-decoration: none;
		white-space: nowrap;
	}

	.primary__link::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 8px;
		height: 1px;
		background: currentColor;
		transform: scaleX(0);
		transform-origin: left;
		transition: transform var(--dur-2) var(--ease-out-quart);
	}

	.primary__link:hover::after,
	.primary__link.is-active::after {
		transform: scaleX(1);
	}

	.primary__link.is-active::after {
		height: 2px;
		background: var(--fg-accent);
	}

	.group {
		position: relative;
	}

	.group__button :global(.chev) {
		transition: transform var(--dur-2) var(--ease-out-quart);
	}

	.group__button[aria-expanded='true'] :global(.chev) {
		transform: rotate(180deg);
	}

	.panel {
		position: absolute;
		top: calc(100% + var(--space-2));
		left: calc(-1 * var(--space-5));
		width: 22rem;
		padding: var(--space-3) 0;
		border: var(--hairline) solid var(--rule-strong);
		box-shadow: 0 18px 40px -18px rgb(13 26 48 / 0.35);
	}

	.panel--end {
		left: auto;
		right: calc(-1 * var(--space-5));
	}

	.panel ul {
		margin: 0;
	}

	.panel a {
		display: grid;
		gap: 2px;
		padding: var(--space-3) var(--space-5);
		text-decoration: none;
		color: var(--fg);
		border-left: 2px solid transparent;
	}

	.panel a:hover,
	.panel a[aria-current='page'] {
		background: var(--c-parchment-50);
		border-left-color: var(--c-navy);
	}

	.panel__label {
		font-weight: 650;
	}

	.panel__desc {
		font-size: var(--fs-meta);
		color: var(--fg-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.masthead.is-solid {
			transform: none;
		}
	}
</style>
