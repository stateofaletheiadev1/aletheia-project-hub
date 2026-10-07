# Example configurations

`devnet-node.toml` and `devnet-node.key` run a single devnet node with the devnet producer.
The key is a published, NON-PRODUCTION development key: `aletheiad` refuses plaintext node
keys on any network other than devnet and regtest (spec Section 19.2).

```sh
cargo run -p aletheiad --features devnet-producer -- --config configs/devnet-node.toml
```
