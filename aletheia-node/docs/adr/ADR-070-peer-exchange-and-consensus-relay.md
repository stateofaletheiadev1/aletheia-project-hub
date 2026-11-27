# ADR-070: Peer exchange, the validator mesh and consensus relay
Status: Accepted
Date: 2026-11-27
Context: A node dials only the `[[peers]]` in its configuration, never learns other nodes, and
never passes on a consensus message it receives (it broadcasts only what its own engine
produces). With validators joining through the registry (ADR-069), two licensed operators that
each dial only the State's validator would never hear each other's votes; with three or more
validators the only safe configuration today is a full mesh written by hand on every host.
Section 36 lists peer exchange on the management channel; it was never built (STATUS).

Decision:
  1. **Peer exchange** on the management channel (types 4-6, after Ping, Pong and Status):
     `ListenPort { port u16 }` is sent once after the handshake, so the other side learns where
     an inbound peer accepts connections (its source port is ephemeral); `GetPeers` asks for
     known peers; `Peers { list<PeerAddress> (<= 64) }` answers with `(node_key, address)`
     pairs. A node asks every peer once on connecting and again every 5 minutes.
  2. **The address book** lives in the network supervisor, which owns all peer state: at most
     512 node keys with the last address each was reachable at, filled from outbound
     connections, from inbound peers' `ListenPort`, and from `Peers` answers. Its own key is
     never stored; a `Peers` answer adds addresses but never replaces one learned from a live
     connection. Answers are capped at 64 entries, newest first.
  3. **The validator mesh.** The node tells the network which node keys are validators of the
     current epoch (`NetworkCommand::SetValidators`, sent at start and at every epoch change).
     The supervisor keeps a dial task, pinned to the key, for every validator it is not
     connected to and has an address for; validators that leave the set lose theirs. Besides
     validators it keeps at least 4 outbound connections to other known peers, so observers and
     syncing nodes stay connected.
  4. **Relay.** A consensus message is passed on, once, to every connected peer except the one
     it came from when it is new to this node (a bounded set of 16,384 message digests, also
     holding everything this node broadcast) and verifies against the current validator set:
     votes and timeouts by signature, proposals by the scheduled leader's signature,
     certificates by their aggregate signature. A message that fails is dropped, never
     forwarded, so a peer cannot use the network to amplify garbage. With the full validator
     mesh relay is redundant by design: it covers the moments a direct connection is down.
  5. **Compatibility.** Unknown management message types are ignored rather than scored as
     malformed, so later additions do not get peers banned. A node of an earlier release
     still scores types 4-6 as malformed: every node of a network moves to this release
     before peers rely on discovery (on Mainnet Beta, the one node first).

Consequences: an operator's node needs one reachable peer in its configuration and finds the
rest; validators connect to each other directly as the set changes. Exchanged addresses are
hints, never trusted: every connection still completes the signed handshake, and validator
connections are pinned to the node key the registry lists. Transport certificate pinning from
the registry follows separately. Tests: message round trips and bounds and the
forward-compatible unknown type (`message.rs`), the address book's bounds and precedence
(`peer_book.rs`), relay deduplication and its bounded memory (`consensus.rs`), and a node-level
run where three validators each configured with only the first discover one another, connect
directly and finalize together (`tests/consensus.rs`; with discovery disabled the same run stays
at peer counts 2, 1, 1 and fails).
