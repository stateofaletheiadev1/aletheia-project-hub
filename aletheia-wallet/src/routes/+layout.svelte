<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { config } from "$lib/config";
  import { prefs } from "$lib/state/prefs.svelte";

  let { children } = $props();
  onMount(() => prefs.init());

  const seo = $derived(page.data.seo);
  const jsonLd = $derived(
    seo && seo.path === "/"
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Sovereign Covenant State of Aletheia",
              url: "https://stateofaletheia.org",
            },
            {
              "@type": "WebApplication",
              name: "Aletheia Wallet",
              url: config.siteUrl,
              applicationCategory: "FinanceApplication",
              operatingSystem: "Any (web browser)",
              description: seo.description,
              publisher: { "@type": "Organization", name: "Sovereign Covenant State of Aletheia" },
            },
          ],
        })
      : null,
  );
</script>

<svelte:head>
  {#if seo}
    <title>{seo.title}</title>
    <meta name="description" content={seo.description} />
    <link rel="canonical" href="{config.siteUrl}{seo.path === '/' ? '' : seo.path}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Aletheia Wallet" />
    <meta property="og:title" content={seo.title} />
    <meta property="og:description" content={seo.description} />
    <meta property="og:url" content="{config.siteUrl}{seo.path === '/' ? '' : seo.path}" />
    <meta property="og:image" content="{config.siteUrl}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
      property="og:image:alt"
      content="Aletheia Wallet, the private ledger, with the arms of the State over a contour map"
    />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seo.title} />
    <meta name="twitter:description" content={seo.description} />
    <meta name="twitter:image" content="{config.siteUrl}/og.png" />
    {#if jsonLd}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, build-time JSON-LD with no user data -->
      {@html `<script type="application/ld+json">${jsonLd}</` + `script>`}
    {/if}
  {:else}
    <title>Aletheia Wallet</title>
    <meta name="robots" content="noindex, nofollow" />
  {/if}
</svelte:head>

{@render children()}
