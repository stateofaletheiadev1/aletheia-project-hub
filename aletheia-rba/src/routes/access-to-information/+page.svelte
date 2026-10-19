<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet policy()}
	<p class="t-lead">Information is published by default.</p>
	<p>
		The Bank publishes its decisions, reports, statistics and register on this website, so that most
		information is available without a request.
	</p>
{/snippet}

{#snippet requests()}
	<p>
		The procedure for requesting documents that are not published, and the limits that protect
		confidential and personal information, will be set out here.
	</p>
{/snippet}

<SimplePage
	title="Access to Information"
	headTitle="Access to information."
	description="How the Reserve Bank of Aletheia publishes information, and how to request documents."
	path="/access-to-information"
	trail={[{ href: '/access-to-information', label: 'Access to information' }]}
	eyebrow="Access to information"
	seed={131}
	sections={[
		{ eyebrow: 'Policy', title: 'Open by default', body: policy },
		{ eyebrow: 'Requests', title: 'Requesting documents', body: requests }
	]}
	related={[
		{ href: '/publications', label: 'Publications' },
		{ href: '/privacy', label: 'Privacy' }
	]}
/>
