# Deployment (Vercel)

1. Create a Vercel project with root `aletheia-wallet/`, framework SvelteKit, Node 22.
2. Production environment variables: see `.env.example` (all public). Leave `PUBLIC_MAINNET_SIGNING`
   unset until the protocol owner confirms the coin type and mnemonic rule.
3. Preview deployments should point at a test network (`PUBLIC_STABLECHAIN_NETWORK=devnet` and its RPC),
   never at mainnet with signing enabled.
4. Deploy: `vercel deploy --prod --yes` from `aletheia-wallet/` (builds on Vercel's Linux; a local
   Windows build skips the adapter because it needs symlinks).
5. Domain: add `wallet.mainnet.stateofaletheia.org` in the Vercel project, then at the DNS host a
   `CNAME wallet.mainnet → cname.vercel-dns.com` (confirm the target Vercel shows for the project). The
   domain is live only after Vercel reports it verified.
6. After deploy: check `/`, `/network`, `robots.txt`, `sitemap.xml`, response headers, and that the seal
   shows the live height.
