<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet rules()}
	<p class="t-lead">
		Images of Aletheian Guilder banknotes may be used only in ways that cannot be mistaken for
		money.
	</p>
	<ul>
		<li>Use the images published on this website, and do not alter them.</li>
		<li>Never print a reproduction on paper or material resembling banknote paper.</li>
		<li>
			Reproduce a note at less than three quarters, or more than one and a half times, its size.
		</li>
		<li>Show only one side of a note in any reproduction.</li>
		<li>Do not reproduce notes on material that resembles banknote paper.</li>
	</ul>
{/snippet}

{#snippet permission()}
	<p>
		Any other use requires the written permission of the Reserve Bank of Aletheia. The designs are
		the property of the Sovereign Covenant State of Aletheia.
	</p>
{/snippet}

<SimplePage
	title="Using Banknote Images"
	headTitle="Using banknote images."
	description="The rules for reproducing images of Aletheian Guilder banknotes."
	path="/banknotes/reproduction"
	trail={[
		{ href: '/currency', label: 'The Guilder' },
		{ href: '/banknotes', label: 'Banknotes' },
		{ href: '/banknotes/reproduction', label: 'Using banknote images' }
	]}
	eyebrow="Banknotes"
	folio="§ 07.2"
	seed={113}
	sections={[
		{ eyebrow: 'Rules', title: 'Reproduction rules', body: rules },
		{ eyebrow: 'Permission', title: 'Other uses', body: permission }
	]}
	related={[
		{ href: '/banknotes', label: 'Banknote designs' },
		{ href: '/terms', label: 'Copyright and disclaimer' }
	]}
/>
