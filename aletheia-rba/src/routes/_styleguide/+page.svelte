<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import BankSeal from '$lib/components/brand/BankSeal.svelte';
	import Eyebrow from '$lib/components/editorial/Eyebrow.svelte';
	import Figure from '$lib/components/editorial/Figure.svelte';
	import Prose from '$lib/components/editorial/Prose.svelte';
	import PullStatement from '$lib/components/editorial/PullStatement.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import DisclosureNotice from '$lib/components/institutional/DisclosureNotice.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import StatusBadge from '$lib/components/institutional/StatusBadge.svelte';
	import Guilloche from '$lib/components/motion/Guilloche.svelte';
	import Button from '$lib/components/primitives/Button.svelte';
	import ButtonLink from '$lib/components/primitives/ButtonLink.svelte';
	import Container from '$lib/components/primitives/Container.svelte';
	import Grid from '$lib/components/primitives/Grid.svelte';
	import Heading from '$lib/components/primitives/Heading.svelte';
	import Icon, { ICONS, type IconName } from '$lib/components/primitives/Icon.svelte';
	import Link from '$lib/components/primitives/Link.svelte';
	import Rule from '$lib/components/primitives/Rule.svelte';
	import Stack from '$lib/components/primitives/Stack.svelte';
	import Text from '$lib/components/primitives/Text.svelte';
	import { STATUS_KEYS } from '$lib/content/status';
	import { contrastRatio } from '$lib/utils/contrast';

	const swatches = [
		'navy',
		'navy-900',
		'navy-700',
		'navy-500',
		'parchment',
		'parchment-50',
		'parchment-200',
		'parchment-400',
		'gold',
		'gold-ink',
		'laurel',
		'ink',
		'ink-muted'
	];

	/** Text/background pairs and the minimum each must meet; `null` marks ornament-only pairs. */
	const pairs: { fg: string; bg: string; min: number | null; use: string }[] = [
		{ fg: 'ink', bg: 'parchment', min: 4.5, use: 'Body text' },
		{ fg: 'navy', bg: 'parchment', min: 4.5, use: 'Headings, rings' },
		{ fg: 'ink-muted', bg: 'parchment', min: 4.5, use: 'Secondary text' },
		{ fg: 'gold-ink', bg: 'parchment', min: 4.5, use: 'Gold-toned text' },
		{ fg: 'laurel', bg: 'parchment', min: 4.5, use: 'Sparingly' },
		{ fg: 'parchment', bg: 'navy', min: 4.5, use: 'Text on navy' },
		{ fg: 'parchment-400', bg: 'navy', min: 4.5, use: 'Muted text on navy' },
		{ fg: 'gold', bg: 'navy', min: 4.5, use: 'Labels on navy, rings' },
		{ fg: 'gold', bg: 'parchment', min: null, use: 'Ornament only, never text' }
	];

	let values = $state<Record<string, string>>({});

	$effect(() => {
		const css = getComputedStyle(document.documentElement);
		const next: Record<string, string> = {};
		for (const s of swatches) next[s] = css.getPropertyValue(`--c-${s}`).trim();
		values = next;
	});

	const ratio = (fg: string, bg: string) => {
		const a = values[fg];
		const b = values[bg];
		return a && b ? contrastRatio(a, b) : null;
	};

	const iconNames = Object.keys(ICONS) as IconName[];
	const scale = [
		['display', 'Stewardship of the Guilder'],
		['h1', 'Monetary policy framework'],
		['h2', 'Preconditions for convertibility'],
		['h3', 'Issuance register'],
		['h4', 'Design concept']
	] as const;
</script>

<svelte:head>
	<title>Styleguide · Reserve Bank of Aletheia</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main id="main">
	<section class="surface-navy section--tight sg-head">
		<Container>
			<Eyebrow folio="§ 00">Development only</Eyebrow>
			<Heading level={1} size="display">Styleguide</Heading>
			<Text size="lead" muted measure>
				Tokens, type, primitives and motion for rba.aletheiagov.org. This page is not built for
				production.
			</Text>
		</Container>
	</section>

	<section class="section--tight surface-parchment">
		<Container>
			<SectionHeader folio="§ 00.1" eyebrow="Brand" title="The Bank's seal and mark" />
			<div class="brand-row">
				<BankSeal size={280} title="Seal of the Reserve Bank of Aletheia" />
				<BankSeal variant="mark" size={120} />
				<BankSeal variant="mark" size={48} />
				<BankSeal variant="mark" size={32} />
			</div>
		</Container>
	</section>
	<section class="section--tight surface-navy">
		<Container>
			<div class="brand-row">
				<BankSeal size={280} />
				<BankSeal variant="mark" size={120} />
				<BankSeal variant="mark" size={48} />
				<BankSeal variant="mark" size={32} />
			</div>
		</Container>
	</section>

	<section class="section--tight surface-parchment">
		<Container>
			<SectionHeader folio="§ 01" eyebrow="Colour" title="Palette and contrast" />
			<ul class="swatches" role="list">
				{#each swatches as s (s)}
					<li>
						<span class="chip" style:background="var(--c-{s})"></span>
						<code>--c-{s}</code>
						<span class="t-fine">{values[s] ?? ''}</span>
					</li>
				{/each}
			</ul>

			<table class="contrast">
				<caption class="visually-hidden">Measured contrast of text and background pairs</caption>
				<thead>
					<tr><th scope="col">Pair</th><th scope="col">Ratio</th><th scope="col">Rule</th></tr>
				</thead>
				<tbody>
					{#each pairs as p (p.fg + p.bg)}
						{@const r = ratio(p.fg, p.bg)}
						<tr>
							<td>
								<span
									class="sample"
									class:sample--rule={p.min === null}
									style:color="var(--c-{p.fg})"
									style:background="var(--c-{p.bg})"
									aria-hidden={p.min === null ? 'true' : undefined}
									>{p.min === null ? '' : 'Aa'}</span
								>
								{p.fg} on {p.bg}
							</td>
							<td class="num">{r ? r.toFixed(2) + ':1' : '…'}</td>
							<td>
								{#if p.min === null}
									{p.use}
								{:else if r !== null}
									{r >= p.min ? 'Pass' : 'Fail'} (needs {p.min}:1) · {p.use}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Container>
	</section>

	<section class="section--tight surface-raised">
		<Container>
			<SectionHeader folio="§ 02" eyebrow="Typography" title="Manrope, one family" />
			<Stack gap={6}>
				{#each scale as [size, sample] (size)}
					<div class="type-row">
						<code class="t-fine">{size}</code>
						<p class="t-{size}">{sample}</p>
					</div>
				{/each}
				<div class="type-row">
					<code class="t-fine">lead</code>
					<p class="t-lead measure">
						The Bank intends to publish its issuance rules before any currency is issued.
					</p>
				</div>
				<div class="type-row">
					<code class="t-fine">body</code>
					<p class="measure">
						Credibility comes from issuance rules, governance, transparency and an honest statement
						of current status. Figures use tabular lining numerals: <span class="num"
							>1 · 5 · 10 · 20 · 100</span
						>.
					</p>
				</div>
				<div class="type-row">
					<code class="t-fine">meta</code>
					<p class="t-meta">§ 04 · Currency notice · 19 October 2026</p>
				</div>
				<div class="type-row">
					<code class="t-fine">fine</code>
					<p class="t-fine">Footnotes and legal lines.</p>
				</div>
			</Stack>
		</Container>
	</section>

	<section class="section--tight surface-parchment">
		<Container>
			<SectionHeader folio="§ 03" eyebrow="Primitives" title="Controls and links" />
			<Stack gap={6}>
				<div class="row">
					<Button>Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="quiet"><Icon name="flip" /> Show back</Button>
					<ButtonLink href="/">The Aletheian Guilder</ButtonLink>
					<ButtonLink href="/" variant="secondary">Current status</ButtonLink>
				</div>
				<div class="row">
					<Link href="/" arrow>Read the current status</Link>
					<Link href="https://www.stateofaletheia.org" newTab>State of Aletheia</Link>
					<a href="/" class="draw-underline">Drawn underline</a>
				</div>
				<ul class="icons" role="list">
					{#each iconNames as name (name)}
						<li><Icon {name} /><span class="t-fine">{name}</span></li>
					{/each}
				</ul>
				<Rule />
				<Rule variant="strong" />
				<Rule variant="seal" />
			</Stack>
		</Container>
	</section>

	<section class="section--tight surface-navy">
		<Container>
			<SectionHeader folio="§ 04" eyebrow="Institutional" title="Status, on navy" />
			<ul class="badges" role="list">
				{#each STATUS_KEYS as key (key)}
					<li><StatusBadge status={key} asOf="2026-10-19" /></li>
				{/each}
			</ul>
			<div class="row">
				<Button>Primary on navy</Button>
				<ButtonLink href="/" variant="secondary">Secondary on navy</ButtonLink>
			</div>
		</Container>
	</section>

	<section class="section--tight surface-parchment">
		<Container>
			<SectionHeader
				folio="§ 05"
				eyebrow="Institutional"
				title="Status, notices and empty states"
			/>
			<Grid>
				<div class="md:span-6">
					<ul class="badges" role="list">
						{#each STATUS_KEYS as key (key)}
							<li><StatusBadge status={key} /></li>
						{/each}
					</ul>
				</div>
				<div class="md:span-6">
					<DisclosureNotice>
						<p>
							Aletheia currently holds no euro reserves, and the Bank holds no foreign reserves.
						</p>
					</DisclosureNotice>
				</div>
			</Grid>
			<EmptyState title="No publications yet">
				<p>
					Monetary policy statements, currency notices and reports will be listed here when they are
					published.
				</p>
			</EmptyState>
			<PullStatement>
				A fiat currency draws its credibility from rules, governance and candour.
			</PullStatement>
			<Prose>
				<h2>Prose</h2>
				<p>Long-form text for policy and legal pages, set to a 66-character measure.</p>
				<ul>
					<li>Ruled headings</li>
					<li>Muted list markers</li>
				</ul>
			</Prose>
		</Container>
	</section>

	<section class="section--tight surface-navy">
		<Container>
			<SectionHeader folio="§ 06" eyebrow="Motion" title="Guilloché and reveals" />
			<Grid>
				<div class="md:span-4">
					<Figure caption="Rosette, seed 3, drawn on reveal">
						<Guilloche kind="rosette" seed={3} size={320} draw />
					</Figure>
				</div>
				<div class="md:span-4">
					<Figure caption="Rosette, seed 11, static">
						<Guilloche kind="rosette" seed={11} size={320} layers={5} />
					</Figure>
				</div>
				<div class="md:span-4">
					<Figure caption="Lattice, seed 5">
						<Guilloche kind="lattice" seed={5} width={600} height={320} lines={22} />
					</Figure>
				</div>
			</Grid>
			<ol class="reveals" role="list">
				{#each ['Research', 'Consultation', 'Adoption', 'Publication', 'Review'] as step, i (step)}
					<li data-reveal use:reveal={i}><span class="t-meta">{i + 1}</span> {step}</li>
				{/each}
			</ol>
		</Container>
	</section>
</main>

<style>
	.brand-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-7);
	}

	.sg-head {
		padding-top: calc(var(--masthead-h) + var(--space-6));
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-7);
	}

	.swatches li {
		display: grid;
		gap: var(--space-1);
	}

	.chip {
		display: block;
		height: 3.5rem;
		border: var(--hairline) solid var(--line);
	}

	code {
		font-size: var(--fs-fine);
		font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
	}

	.contrast {
		width: 100%;
		font-size: var(--fs-meta);
	}

	.contrast th,
	.contrast td {
		text-align: left;
		padding: var(--space-3) var(--space-4) var(--space-3) 0;
		border-bottom: var(--hairline) solid var(--line);
	}

	.sample {
		display: inline-block;
		padding: 0 var(--space-2);
		margin-right: var(--space-2);
		font-weight: 600;
	}

	/* Ornament-only pairs are shown as a rule, never as text. */
	.sample--rule {
		width: 2.25rem;
		height: 1.25rem;
		vertical-align: middle;
		background-image: linear-gradient(currentColor, currentColor) !important;
		background-size: 100% 1px !important;
		background-position: 0 50% !important;
		background-repeat: no-repeat !important;
		background-color: var(--c-parchment) !important;
	}

	.type-row {
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: var(--space-4);
		align-items: baseline;
		border-top: var(--hairline) solid var(--line);
		padding-top: var(--space-4);
		min-width: 0;
	}

	.type-row p {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		align-items: center;
	}

	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: var(--space-4);
	}

	.icons li {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.badges {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}

	.reveals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-7);
		border-top: var(--hairline) solid var(--line);
	}

	.reveals li {
		padding-top: var(--space-4);
		font-size: var(--fs-h3);
		font-weight: 350;
	}

	.reveals .t-meta {
		display: block;
		color: var(--fg-accent);
	}

	@media (max-width: 479px) {
		.type-row {
			grid-template-columns: 1fr;
		}
	}
</style>
