/**
 * Serves build/ the way the static host does: clean URLs (/about → about.html), 404.html for
 * unknown paths, long caching for hashed assets, and the security headers from vercel.json.
 * Used by the end-to-end tests in place of `vite preview`, which stalls under parallel load.
 *
 * Usage: tsx scripts/serve.ts [port] [host]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { SECURITY_HEADERS } from '../src/lib/security-headers.ts';

const port = Number(process.argv[2] ?? 4173);
const host = process.argv[3] ?? '127.0.0.1';
const root = resolve('build');

const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.xml': 'application/xml; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.woff2': 'font/woff2'
};

function resolveFile(urlPath: string): string | null {
	const safe = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
	if (safe.startsWith('..')) return null;
	const candidates = [join(root, safe), join(root, `${safe}.html`), join(root, safe, 'index.html')];
	for (const file of candidates) {
		if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) return file;
	}
	return null;
}

createServer((req, res) => {
	const path = new URL(req.url ?? '/', 'http://local').pathname;
	const file = resolveFile(path);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
	const target = file ?? join(root, '404.html');
	res.statusCode = file ? 200 : 404;
	res.setHeader('Content-Type', TYPES[extname(target)] ?? 'application/octet-stream');
	if (path.startsWith('/_app/immutable/')) {
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
	}
	createReadStream(target).pipe(res);
}).listen(port, host, () => {
	console.log(`Serving build/ at http://${host}:${port}`);
});
