<script lang="ts">
	import { CONTACT, FOOTER_NAV, LEGAL_NAV, SITE } from '$lib/content/site';
	import BankSeal from '../brand/BankSeal.svelte';
	import Guilloche from '../motion/Guilloche.svelte';
	import Icon from '../primitives/Icon.svelte';

	// Computed when the page is prerendered.
	const year = new Date().getFullYear();
</script>

<footer class="footer surface-navy" id="site-footer">
	<div class="ground" aria-hidden="true">
		<Guilloche kind="lattice" seed={42} width={1440} height={220} lines={26} strokeWidth={0.5} />
	</div>

	<div class="container">
		<div class="statement">
			<a href="/" class="mark">
				<BankSeal size={104} />
				<span class="mark__name">{SITE.name}</span>
			</a>
			<div class="status">
				<p class="t-meta status__label">Veritas in Foedere</p>
				<p class="status__text">
					The monetary institution of the Sovereign Covenant State of Aletheia, and steward of the
					Aletheian Guilder.
				</p>
				<a href="/about" class="status__link">
					About the Bank <Icon name="arrow-right" size={16} class="nudge" />
				</a>
			</div>
		</div>

		<nav aria-label="Footer" id="site-footer-nav" class="ledger-cols">
			{#each FOOTER_NAV as col (col.heading)}
				<div class="col">
					<h2 class="t-meta col__heading">{col.heading}</h2>
					<ul role="list">
						{#each col.links as link (link.href)}
							<li><a href={link.href}>{link.label}</a></li>
						{/each}
					</ul>
				</div>
			{/each}
			<div class="col">
				<h2 class="t-meta col__heading">Aletheia</h2>
				<ul role="list">
					<li>
						<a href={SITE.stateUrl} rel="noopener"
							>State of Aletheia <Icon name="arrow-up-right" size={12} /></a
						>
					</li>
					<li>
						<a href={SITE.governmentUrl} rel="noopener"
							>Government of Aletheia <Icon name="arrow-up-right" size={12} /></a
						>
					</li>
					{#if CONTACT.email}
						<li><a href="mailto:{CONTACT.email}">{CONTACT.email}</a></li>
					{/if}
				</ul>
			</div>
		</nav>

		<div class="base">
			<p class="t-fine">
				© {year}
				{SITE.state}. {SITE.name}.
			</p>
			<ul role="list" class="legal">
				{#each LEGAL_NAV as link (link.href)}
					<li><a href={link.href}>{link.label}</a></li>
				{/each}
			</ul>
		</div>
	</div>
</footer>

<style>
	.footer {
		position: relative;
		overflow: hidden;
		padding-block: var(--space-9) var(--space-6);
		border-top: 4px double var(--c-gold);
	}

	.ground {
		position: absolute;
		inset: 0 0 auto;
		height: 220px;
		opacity: 0.18;
		pointer-events: none;
	}

	.ground :global(svg) {
		height: 100%;
	}

	.container {
		position: relative;
	}

	.statement {
		display: grid;
		gap: var(--space-6);
		padding-bottom: var(--space-7);
		border-bottom: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 768px) {
		.statement {
			grid-template-columns: 5fr 7fr;
			align-items: start;
		}
	}

	.mark {
		display: inline-flex;
		align-items: center;
		gap: var(--space-4);
		text-decoration: none;
		color: var(--fg);
	}

	.mark__name {
		font-size: var(--fs-h3);
		font-weight: 350;
		letter-spacing: -0.01em;
		line-height: 1.15;
		max-width: 12ch;
	}

	.status {
		display: grid;
		gap: var(--space-3);
		border-left: 2px solid var(--c-gold);
		padding-left: var(--space-5);
	}

	.status__label {
		color: var(--fg-accent);
	}

	.status__text {
		font-size: var(--fs-lead);
		line-height: 1.45;
		max-width: 46ch;
	}

	.status__link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		width: fit-content;
		min-height: 44px;
	}

	.ledger-cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-6) var(--gutter);
		padding-block: var(--space-7);
	}

	.col {
		border-top: var(--hairline) solid var(--line);
		padding-top: var(--space-4);
	}

	.col__heading {
		color: var(--fg-muted);
		margin-bottom: var(--space-3);
		font-size: var(--fs-fine);
	}

	.col ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
	}

	.col a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 36px;
		text-decoration: none;
	}

	.col a:hover {
		text-decoration: underline;
	}

	.base {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-4);
		padding-top: var(--space-5);
		border-top: var(--hairline) solid var(--line);
	}

	.legal {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		margin: 0;
		font-size: var(--fs-fine);
	}

	.legal a {
		color: var(--fg-muted);
		display: inline-block;
		padding-block: var(--space-2);
	}
</style>
