# Release checklist

- [ ] `npm run check`, `npm run lint`, `npm run test:coverage` green
- [ ] devnet running; `npm run test:integration` and `npm run test:e2e` green
- [ ] `npm run build` green (budgets and public-bundle boundary)
- [ ] `npm run contrast` green
- [ ] `npm audit --omit=dev` reviewed
- [ ] screenshots reviewed at 1440 / 1024 / 390 in both themes (`npm run screenshots`)
- [ ] `PUBLIC_MAINNET_SIGNING` matches the owner's decision
- [ ] genesis block pinned for the target network
- [ ] deployed; headers, robots, sitemap and live seal verified on the domain
