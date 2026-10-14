# RPC discovery and validation

ACE never assumes an RPC port. Port 8545 appears nowhere in StableChain or in ACE; the shipped
profiles use 7781 because the node's configuration says 7781.

## What the node offers (audited commit)

- RPC exists only if the node TOML has an `[rpc]` section (`listen`, optional
  `requests_per_second`, default 50 per client IP).
- `POST /rpc/v1`: JSON-RPC 2.0, named parameters only, batches of 1-50, 1 MiB body cap.
- `/api/v1/…`: REST over the same service.
- No `/` route, no WebSocket route, no CORS headers.
- Methods: `getNetworkStatus`, `getChainHead`, `getFinalizedHead`, `getChainParams`, `getBlock`,
  `getBlockByHeight`, `getFinalityProof`, `submitTransaction`, `simulateTransaction`,
  `getTransaction`, `getReceipt`, `getAccount`, `getBalance`, `getAssets`, `getMonetarySupply`,
  `getValidatorSet`. Ethereum method names answer `-32601`.

## Discovery, step by step (`rpc::inspect`)

1. **Configuration.** Parse the node TOML with the daemon's schema. No `[rpc]` → report
   "RPC is disabled" and stop: there is nothing to discover, check or expose.
2. **Daemon announcement.** Read the daemon's line
   `rpc listening on <addr> (REST /api/v1, JSON-RPC /rpc/v1)`. With `listen` port 0 this line is
   the only source of the real port. If it names a different address than the configuration,
   ACE refuses to guess.
3. **Socket table.** On Linux, find the listening socket for that address in `/proc/net/tcp{,6}`
   and check its inode is held by the node's process (`/proc/<pid>/fd`). "Another process
   listens there" and "nothing listens there" are reported as such.
4. **Protocol.** `POST /rpc/v1` with
   `{"jsonrpc":"2.0","id":1,"method":"getNetworkStatus","params":{}}`. The answer must be JSON-RPC
   2.0 with the same id and a result holding `chainId` (number), `network` (string),
   `protocolVersion`, `finalizedHeight` (numbers), `finalizedBlock` (an `AL:B…` id) and
   `syncing` (boolean). An error object, a different id, an Ethereum-shaped result or HTTP 404
   all fail.
5. **Identity.** `chainId` and `network` must be the deployment's.
6. **P2P is not RPC.** The same request is sent to the P2P address; it must fail (the P2P port
   speaks TLS). If it answered, either could be mistaken for the other by anything that looks
   only at ports, and ACE marks RPC unhealthy.

The report keeps the configured address, the effective address, the URL, whether it is loopback
only, the socket holder, the P2P address, and the status, separately.

## Health

`getNetworkStatus` is read-only, takes no parameters and returns identity and height, so it is
the health check. Its `syncing` field is `false` unconditionally at the audited commit and
`peers` is `null`; ACE records both and relies on neither. Liveness of a producer or validator is
judged from the finalized height advancing.

Process state and RPC state are reported separately (`ace status`: `node pid …` and
`rpc … healthy …`). The supervisor probes every `health_interval_s` and goes DEGRADED when the
probe fails, which also catches the daemon's RPC task dying while the process runs (audit F29).

## Local and public

The local listener and the public endpoint are separate facts with separate checks. The public
endpoint (`[tunnel] public_url`) is reported up only after a request through it returns the same
chain at a height not behind the local node and, in `ace public-check`, the same block id at the
local height. See `DEPLOYMENT.md` for the tunnel.
