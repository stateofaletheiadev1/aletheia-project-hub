<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet aims()}
	<p class="t-lead">
		A small nation’s currency is strengthened by the company it keeps. The Bank intends to work
		closely with other central banks and international institutions.
	</p>
{/snippet}

{#snippet learning()}
	<p>
		Many nations have built central banks in recent decades, among them small island states and
		newly independent countries. Their experience, good and bad, is a resource the Bank intends to
		use with care: what to adopt, what to adapt and what to avoid.
	</p>
{/snippet}

{#snippet areas()}
	<dl>
		<div>
			<dt>Central banks</dt>
			<dd>
				Exchange of experience on policy, payments and banknotes, and technical cooperation as the
				Bank is built.
			</dd>
		</div>
		<div>
			<dt>International institutions</dt>
			<dd>
				Participation in the standards and forums of the central banking community, and adoption of
				its principles.
			</dd>
		</div>
		<div>
			<dt>Statistics</dt>
			<dd>Data published to international standards, so that others can rely on it.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="International Cooperation"
	headTitle="International cooperation."
	description="How the Reserve Bank of Aletheia intends to work with other central banks and international institutions."
	path="/about/international"
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/international', label: 'International cooperation' }
	]}
	eyebrow="International cooperation"
	folio="§ 01.9"
	seed={101}
	sections={[
		{ eyebrow: 'Aims', title: 'Working with others', body: aims },
		{ eyebrow: 'Experience', title: 'Learning from others', body: learning },
		{ eyebrow: 'Areas', title: 'Where we cooperate', body: areas }
	]}
	related={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/payments', label: 'Payments' }
	]}
/>
