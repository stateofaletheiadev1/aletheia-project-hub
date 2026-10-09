/**
 * Aletheia StableChain: the one place the website states facts about the national ledger.
 * Every page that names an endpoint, a format or a parameter imports it from here, so the
 * site cannot drift from the chain. Sources: the node specification (aletheia-node,
 * docs/spec/MASTER.md, Sections 10, 12, 18, 19, 23, 29, 37) and the State's endpoints.
 */

/** Public endpoints of the mainnet. The RPC answers once mainnet is on air. */
export const STABLECHAIN = {
  rpc: 'https://rpc.stateofaletheia.org',
  /** REST interface (Section 37.1). */
  rest: 'https://rpc.stateofaletheia.org/api/v1',
  /** JSON-RPC 2.0 interface (Section 37.2). */
  jsonRpc: 'https://rpc.stateofaletheia.org/rpc/v1',
  explorer: 'https://explorer.mainnet.stateofaletheia.org',
  network: 'mainnet',
  /** APS-0001: the mainnet chain ID is assigned in the genesis ceremony, not before. */
  chainId: null as number | null,
  networkKind: 1,
  protocolVersion: 1,
  slotMs: 500,
  /** Address checksum prefix (human-readable part) on mainnet. */
  addressHrp: 'al',
} as const;

/** The two native assets (Section 18.3). */
export const NATIVE_ASSETS = [
  {
    code: 'AEY',
    name: 'Aletheian Guilder',
    decimals: 18,
    role: 'Legal tender of the Sovereign Covenant State, in banknotes and on StableChain; 1 AEY = 1 EUR.',
  },
  {
    code: 'ALnT',
    name: 'Aletheian Talent',
    decimals: 3,
    role: 'The network utility and staking asset; it pays transaction fees.',
  },
] as const;

/**
 * Example identifiers for illustrations (sample statements, the demo portal). They are
 * correctly formed mainnet text (valid checksums, generated with the explorer's APS-0002
 * code from fixed labels) and name no real account, transaction or block.
 */
export const EXAMPLE = {
  address: 'AL:qq4w8las6xwf2d4fyzeqnadmx5jcrqleyh5jja988v8jylzzhujkkamd3k4',
  citizen: 'AL:qp3f3ak4x56xchdg3n39eny2hs0xrhs25jvz7x64zv292slrn63pwhrwyxt',
  treasury: 'AL:qr6g5wd4as5cgkcdjpdw67trytw7t7c2hejnpxay264eqsq5dwcp6jlx6gq',
  citizenPublicKey: '3b9d366a42461e5a9637817911772474485d61d133b7c2645ece202ffcfbf986',
  tx: [
    'AL:Tf77xujdm89atzthxpwfeyzt872d9xjjau2ut6mhmsc2jy9r70v8qd9mrrc',
    'AL:Trfppjnh4sxf6wav2ljxvq8sx2yzglhn06sjk6tqgs9uhv96r3ucqtjan67',
    'AL:Tkvgqfz6y98vjcz8n9z9dslzzzuqz5xcpckmapv7r2jum96hue0sqm283k3',
    'AL:T4kmfttjr92v92w0fjpd6hkrkydjxgzyjd48dz78qtul6vza59n7s6ukuha',
    'AL:Thm44l3hfkuzdnxvf5fj7ujppjfv4pahpmy9226fw94qfzfjhd4kqapd29q',
    'AL:T0e46wm7akz495lvc0padmsa5esgjc4yw9jklp9g9cpfhw8m48c6quj7r43',
    'AL:T9srtalrxcgqaw9dwkcnq3xn3tql9rw86mysyq84e953lkl0wnc4qzdrdnh',
    'AL:Txn9s5yek3mjkmd2dp5sxwev0vt78c4c284umk73r7gexv2jy0m0qyan2wj',
    'AL:Tdhwcu5zjm9ez6ww4c7gln58y2n0sxfrnlynfrrszdja0yueafuxqpwjxa6',
    'AL:T4xfeu39zmehd48d66e5lmnpp38vl687p9arkcazezve74x528xwsx22zva',
    'AL:Tf0m2upu8gesx430x3499zyg4tuxppplz879c3apw9ncgny6878xs5jj8k0',
    'AL:Tn9uwch57mhz6u72y55xjtlgvfj93jncuvpd7mg0wev37g8dlj66skheygl',
  ],
  block: [
    'AL:Bvdmvg9up3adj8jspulajwxzu887kux7dmzal6srntnk48u4ms2wqxjapv0',
    'AL:Blmpy86578pvagzvqs25tq2flulz7xuqnzcvw95pp2yct0saqf80se06tgv',
    'AL:Bpqg2tcvl5qcl356necww97ss7yxd90zah84ll52utlvel9hqs6rswjegfy',
  ],
  hash: [
    '6084717324f35d2c7f9a7155d761132e815b8c0c2a1734fcbccf0ed649167c48',
    '57d4e3304169553f140aff611c1da018cf9ebfaa1dc3b4b0070d38b88cb22849',
    'd05c5630acfeee5bd09d7e0a78211bf64d344d57d4e6e5af27a672afb9b96e3b',
    'fc77ef9f8bb00d54cdd6ea044cd81cda4376daf5e26d875c5b71e2fb70469fcc',
    '281999f1cea8f0a762549be21a3ebeb92a0a1aaa54183e2c7e77c16579524ff9',
    'e5c24befd719b340626e146ae2b40158d3cba2f2b8ab8c100845be678ceee965',
    'e3f51901eb13e8d6ec8e044890882218871d3b504330212aeedd03197db46bd3',
    '9523a629d7a620e52083478a064986438d0938dc0b1fbf15b25794b89f7c5a9b',
    '0b8b55989f1bad1fd64735d3603d8627212b6528bb88f5952f8e24570c6d9582',
    '44d270f72e1664c91dd71b7a01ef783a5dce93d3ab85c7fb12518bf2964088e4',
    '0a5044024460f3757092e03cfeef8f0e870560609e6ff21c82308cdda0331266',
    'b634b998bd60e6a36663f09003517090cac7d1c85dcca19be6169fb46d5f9839',
    '32b81ae533acddd2c2e7646030717b66e810b05cde5eee19ba38639f365efc3c',
    'eef55ab53176e14d9f234907faf3191cd0c4e0c779553e5bebc015d29581d65a',
    'e08db1371c5430837c57c4e5e6dee6d0e29ff934a2fa6d0be892c6b5ef1ae557',
    'f87e3525408625ec94beffe986df6a67f25739dde6c0134564c14846d276ac20',
  ],
} as const;

/** "AL:Tf77xujd…mrrc": the first 10 and last 4 characters, for tight spaces; the full text stays in `title`. */
export const shortId = (id: string, head = 10, tail = 4) => (id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`);

/** How identifiers are written (APS-0002). Aletheia never uses the 0x prefix. */
export const IDENTIFIER_FORMATS = [
  { what: 'Account address', form: 'AL:…', example: EXAMPLE.address },
  { what: 'Transaction ID', form: 'AL:T…', example: EXAMPLE.tx[0] },
  { what: 'Block ID', form: 'AL:B…', example: EXAMPLE.block[0] },
  { what: 'Hashes and roots', form: '64 lowercase hex characters', example: EXAMPLE.hash[0] },
] as const;

/** Explorer links for an object, by kind. */
export const explorerUrl = {
  home: () => STABLECHAIN.explorer,
  block: (heightOrId: string | number) => `${STABLECHAIN.explorer}/blocks/${encodeURIComponent(String(heightOrId))}`,
  tx: (id: string) => `${STABLECHAIN.explorer}/tx/${encodeURIComponent(id)}`,
  address: (address: string) => `${STABLECHAIN.explorer}/address/${encodeURIComponent(address)}`,
};

/** A transfer uses 2,000 execution units (Section 29); the fee is EU × the posted EU price. */
export const TRANSFER_EU = 2_000;

/** Where the website's figures came from: the public RPC, a local node, or the reference values below. */
export type ChainSource = 'online' | 'local' | 'reference';

/** What the website's server reports about the chain (see app/api/chain/route.ts). */
export type ChainStatus =
  | { live: false; source: 'reference'; checkedAt: string }
  | {
      live: true;
      source: 'online' | 'local';
      /** The RPC that answered. */
      rpc: string;
      checkedAt: string;
      network: string;
      chainId: number;
      protocolVersion: number;
      height: number;
      epoch: number;
      blockId: string;
      timeMs: number;
      txCount: number;
    };
