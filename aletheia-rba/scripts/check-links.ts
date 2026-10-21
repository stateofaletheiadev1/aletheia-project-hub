/**
 * Crawls the built site through scripts/serve.ts, so URLs resolve exactly as on the host
 * (/about is about.html even though an about/ folder also exists). The site's own canonical
 * origin is skipped until the domain is live.
 */
import { LinkChecker } from 'linkinator';
import { startServer } from './serve.ts';

const port = 4199;
const server = await startServer(port);
const checker = new LinkChecker();
const result = await checker.check({
	path: `http://127.0.0.1:${port}/`,
	recurse: true,
	linksToSkip: ['^https://rba[.]aletheiagov[.]org']
});
server.close();

const broken = result.links.filter((l) => l.state === 'BROKEN');
for (const l of broken) console.error(`[${l.status}] ${l.url}  (from ${l.parent})`);
console.log(`${result.links.length} links checked, ${broken.length} broken.`);
process.exit(broken.length ? 1 : 0);
