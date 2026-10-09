import { STABLECHAIN, type ChainSource, type ChainStatus } from '@/lib/stablechain';

/**
 * The chain's status as the website shows it, asked on the server so the browser never
 * needs cross-origin access to a node. Sources, in order:
 *
 *   1. the State's public RPC (https://rpc.stateofaletheia.org), once it is on air;
 *   2. a node on this machine (http://127.0.0.1:7781), only when the site runs in
 *      development, e.g. `npm run dev` next to a running `aletheiad`;
 *   3. otherwise the reference values in lib/stablechain.ts, labelled as such.
 *
 * STABLECHAIN_LOCAL_RPC overrides the local address. Nothing is ever simulated: the
 * reference answer carries the network's fixed facts and no live figures.
 */
const LOCAL_RPC = process.env.STABLECHAIN_LOCAL_RPC ?? 'http://127.0.0.1:7781';
const SOURCES: { source: Exclude<ChainSource, 'reference'>; url: string }[] = [
  { source: 'online', url: STABLECHAIN.rpc },
  ...(process.env.NODE_ENV !== 'production' || process.env.STABLECHAIN_LOCAL_RPC
    ? [{ source: 'local' as const, url: LOCAL_RPC }]
    : []),
];

async function get<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base.replace(/\/+$/, '')}/api/v1${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(2_500),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

async function ask(source: Exclude<ChainSource, 'reference'>, url: string, checkedAt: string): Promise<ChainStatus> {
  const [network, head] = await Promise.all([
    get<{ network: string; chainId: number; protocolVersion: number }>(url, '/network/status'),
    get<{ id: string; height: number; epoch: number; protocolTimeMs: number; txCount: number }>(url, '/chain/head'),
  ]);
  return {
    live: true,
    source,
    rpc: url,
    checkedAt,
    network: network.network,
    chainId: network.chainId,
    protocolVersion: network.protocolVersion,
    height: head.height,
    epoch: head.epoch,
    blockId: head.id,
    timeMs: head.protocolTimeMs,
    txCount: head.txCount,
  };
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  let status: ChainStatus = { live: false, source: 'reference', checkedAt };
  for (const { source, url } of SOURCES) {
    try {
      status = await ask(source, url, checkedAt);
      break;
    } catch {
      // Not reachable: try the next source.
    }
  }
  return Response.json(status, { headers: { 'cache-control': 'public, max-age=5, stale-while-revalidate=25' } });
}
