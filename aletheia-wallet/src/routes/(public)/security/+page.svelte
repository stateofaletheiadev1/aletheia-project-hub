<script lang="ts">
  import Editorial from "$lib/layouts/Editorial.svelte";
  import { config } from "$lib/config";
</script>

<Editorial
  eyebrow="Security"
  title="How your keys are kept"
  lede="Every key is generated, sealed and used inside your browser. The wallet's servers deliver the application and nothing else; they never see a phrase, a key or a password."
  sections={[
    { id: "keys", label: "Keys" },
    { id: "sealing", label: "Sealing" },
    { id: "signing", label: "Signing" },
    { id: "network", label: "Network checks" },
    { id: "you", label: "What you can do" },
  ]}
>
  <section id="keys">
    <h2>Keys are made on your device</h2>
    <p>
      A 24-word recovery phrase is drawn from your device's own randomness. Accounts are derived from it with SLIP-0010
      Ed25519 on the path m/44'/7771'/0'/0'/i'. The work happens in an isolated worker inside the page, apart from the
      interface.
    </p>
  </section>
  <section id="sealing">
    <h2>Sealed with your password</h2>
    <p>
      The phrase is encrypted with XChaCha20-Poly1305 under a key stretched from your password by Argon2id (64 MiB,
      three passes) — deliberately slow, to resist guessing. Only the sealed copy is stored in the browser. Locking,
      manually or after inactivity, clears the keys from memory.
    </p>
  </section>
  <section id="signing">
    <h2>You see what you sign</h2>
    <p>
      Before you sign, the transfer is priced by the network and shown as a formal instruction decoded from the exact
      bytes to be signed: recipient, amount, fee, network and validity. Signing needs a deliberate press and hold.
    </p>
  </section>
  <section id="network">
    <h2>The network is checked every time</h2>
    <p>
      The wallet signs only for AletheiaChain chain {config.chainId} with the expected genesis block. Addresses carry a checksum
      bound to their network, so an address from another Aletheia network is refused rather than silently accepted.
    </p>
  </section>
  <section id="you">
    <h2>What you can do</h2>
    <ul>
      <li>Open the wallet only at <strong>{new URL(config.siteUrl).host}</strong>. Bookmark it.</li>
      <li>
        Write the phrase on paper. Never photograph it, never type it into another site, never share it — no official
        will ask for it.
      </li>
      <li>Check the first and last characters of an address after pasting; some malware replaces copied addresses.</li>
      <li>Lock the wallet on shared computers.</li>
    </ul>
    <p>Report a vulnerability to <a href="mailto:security@stateofaletheia.org">security@stateofaletheia.org</a>.</p>
  </section>
</Editorial>
