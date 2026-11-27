# Validator licensing: operator and Council runbook

Protocol version 2 (ADR-069). Every command simulates the transaction first and signs nothing
if it would fail; a transaction that is finalized but fails exits non-zero. Add
`--network mainnet` to every command on Mainnet Beta so a wrong `--rpc` cannot sign for another
chain. Amounts are in ALnT (3 decimals).

## Before anything: protocol version 2 on every node

1. Install the version-2 `aletheiad` on every node (`docs/operations/vps.md`, section 6).
2. The Council schedules the upgrade at least 8 governance epochs ahead plus a safety margin:

   ```sh
   aletheia-cli --network mainnet gov propose --keystore council.json \
     schedule-upgrade --version 2 --height <height>
   aletheia-cli --network mainnet gov execute --keystore council.json --proposal <id>   # after the timelock
   ```

   A node that has not upgraded by `<height>` stops cleanly (exit 75) instead of forking.

3. Rewards: fund the pool from the treasury and set the policy (one day of 500 ms slots is
   172800; the state beneficiary receives the share earned by the state's own validators).

   ```sh
   aletheia-cli --network mainnet transfer --keystore treasury.json \
     --to alt:000000000000000000000000000000000000000b --asset ALnT --amount <amount>
   aletheia-cli --network mainnet gov propose --keystore council.json \
     reward-policy --period-slots 172800 --pool-payout <ALnT per day> --beneficiary <treasury alt:>
   ```

## An operator joins

1. On the validator's own host, make its keys (they never leave it):

   ```sh
   aletheia-signer keygen --kind consensus --chain-id 7770 --network mainnet \
     --out consensus-key.json --password-file pw
   aletheia-signer keygen --kind node --out node-key.json --password-file pw
   ```

   The first prints `consensus_key` and `proof_of_possession`, the second the node key.

2. Connect the node to Mainnet Beta and start it with the signer daemon (`docs/operations/vps.md`
   sections 1-3 for the build, users, systemd and the daemon). Its `/etc/aletheia/node.toml`:

   ```toml
   [node]
   data_dir = "/var/lib/aletheia"
   genesis = "/etc/aletheia/genesis.toml"   # a copy of genesis/mainnet-beta.toml in this repository
   listen = "0.0.0.0:7771"                  # open TCP 7771 in the host firewall and the cloud's
   node_keystore = "/etc/aletheia/node-key.json"
   node_key_password_file = "/run/credentials/aletheiad.service/node-key-password"

   [signer]
   socket = "/run/aletheia-signer/signer.sock"

   # The State's validator: the node fetches the chain from it and finds the other validators.
   [[peers]]
   address = "9.205.24.247:7771"
   node_key = "44fd466a9b450e9a417177fd84ac7d748f5cb8ec03490f0d286de71112e5c049"

   [rpc]
   listen = "127.0.0.1:7781"                # local only; never expose a validator's RPC
   ```

   On first start the node checks the genesis (chain 7770, genesis id
   `a3ad0e1a821776800698ec99d672f00f5d084870d3230a1391fda45a58ba90ad`) and re-executes every block
   from genesis before it is current; on a 4 vCPU host this takes hours, once. Until the Council
   admits it, it follows the chain as an observer (`aletheiad info this node key is not in the
   validator set ...`). `curl -s 127.0.0.1:7781/api/v1/network/status` shows its height.

3. The operator registers from its own account, locking the bond (minimum 10,000 ALnT unless the
   Council changed it):

   ```sh
   aletheia-cli --network mainnet validator register --keystore operator.json \
     --consensus-key <hex> --proof-of-possession <hex> --node-key <hex> \
     --licence AGV-EOI-YYYY-NNNN --bond 10000
   ```

   The proof of possession is checked locally before anything is sent. `--licence` records
   only a fingerprint of the application reference (never personal data). The Council checks
   it against the approved application with `aletheia-cli validator licence-hash AGV-EOI-…`
   and the explorer's validator page before activating.

4. The Council admits it (1 governance epoch timelock); the node becomes a validator at the
   epoch that begins right after:

   ```sh
   aletheia-cli --network mainnet gov propose --keystore council.json activate-validator --node-key <hex>
   aletheia-cli --network mainnet gov execute --keystore council.json --proposal <id>
   aletheia-cli --network mainnet validator set
   ```

## Leaving, refusing, suspending

| Who | Command | Effect |
|---|---|---|
| Operator | `validator withdraw --node-key` | application not yet decided: bond returned |
| Operator | `validator exit --node-key` | leaves at the end of the epoch; bond returned then |
| Council | `gov propose reject-validator` | application refused; bond returned |
| Council | `gov propose suspend-validator` | out of the set at once (no timelock); keeps its bond |
| Council | `gov propose reinstate-validator` | back in the set |
| Council | `gov propose validator-policy --min-bond --max-validators` | bond and set size |

No action may leave the set empty.

## Keep control of the chain

Every validator has one vote and a block needs about two thirds of them. With 2 or 3 validators,
one offline stops the chain until it returns. Run enough of the state's own validators to reach
two thirds alone (for example 5 of the state's to 2 licensed) while licensed operators join.
