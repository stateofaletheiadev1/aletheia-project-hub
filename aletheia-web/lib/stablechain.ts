/**
 * Aletheia StableChain: the one place the website states facts about the national ledger.
 * Every page that names an endpoint, a format or a parameter imports it from here, so the
 * site cannot drift from the chain. Sources: the node specification (aletheia-node,
 * docs/spec/MASTER.md, Sections 10, 12, 18, 19, 23, 29, 37) and the State's endpoints.
 */

/** Public endpoints of StableChain Mainnet Beta (on air since 27 October 2026). */
export const STABLECHAIN = {
  rpc: 'https://rpc.stateofaletheia.org',
  /** REST interface (Section 37.1). */
  rest: 'https://rpc.stateofaletheia.org/api/v1',
  /** JSON-RPC 2.0 interface (Section 37.2). */
  jsonRpc: 'https://rpc.stateofaletheia.org/rpc/v1',
  explorer: 'https://aletheiascan.mainnet.stateofaletheia.org',
  /** The explorer is linked only while it is deployed; when false every explorer link is hidden. */
  explorerLive: true,
  network: 'mainnet',
  /** APS-0001: assigned at genesis; Mainnet Beta (genesis/mainnet-beta.toml) is chain 7770. */
  chainId: 7770 as number | null,
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
    role: 'The national currency of the Sovereign Covenant State, in banknotes and on StableChain, issued by the Reserve Bank of Aletheia.',
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
 * correctly formed mainnet text (valid EIP-55 case checksums, ADR-062; generated with the
 * explorer's APS-0002 code from fixed labels) and name no real account, transaction or block.
 */
export const EXAMPLE = {
  address: 'alt:a7418e1BD7B3423b42Ccb25255Cbf9F2Cc0DBe8a',
  citizen: 'alt:1045e751912C3AC9A13871e52Ce745734DE7c65b',
  treasury: 'alt:65177Fcb5b49D041A63609d16D9C4c3ce43b0D28',
  citizenPublicKey: '3b9d366a42461e5a9637817911772474485d61d133b7c2645ece202ffcfbf986',
  tx: [
    'alt:T53E2A48AF0f15180c2b398D335Aa5aD8E8B50E4bF743E4c35e18ADA9751Ef393',
    'alt:Tb9bf815FF3622E2D11ac6319830e7bC9eFB148321CAaAa5106e407599519aD3e',
    'alt:Td13403B14f76a6565f57b39B689e96F23f793EBd4dBCB0719568c1cbfe649034',
    'alt:T617C6d8a04281e548Dfe978e15ce91D0518868408aeA45DEA76562511e07aC6a',
    'alt:T109F27a7191b35fb0EC4CA77dDAF6D0996B039A7aDc0FB22df5eB009db77e58b',
    'alt:TAd869ba41F6674C6a1e3716c34B15Ed929924eC6E81a82062c9f43a2E9D11D8c',
    'alt:TA553438697A46e77082485b991Fb7058Ed43b45A9D3475b5E3478911EBd5f5A7',
    'alt:T7745B0593C7bEa3aFf1B7DD97CeE7cbbb8720d2E6128fF2F10Dc0F41bf7D2Dae',
    'alt:Tc3b8cc473772D75c26365f600649BCa1e0b56f5037Bbd49B7aCb2A5792dFC4CF',
    'alt:TdAf549B9996bc611F9Fdc15218913990beAb2F86EE386290eA2E1dD5AdE91b2d',
    'alt:T3982c4Ee48f9A3efF12BD21EEAe5544176d3022c31D4B252c54E57eAdC2407E0',
    'alt:Te30545CE2bBa613E08EF06B25e63f367d781C24296412511dA5155A563b7EF06',
  ],
  block: [
    'alt:B7768512e464d1C957fe7DC23CCe8aea0Bd23d2B0f7673bf3FaA15C27c902f200',
    'alt:B8DeE2f3835dDA2A6E0157D74a14f3137F17ab774383dDDB63a12a714133c4C78',
    'alt:BAfe7223dE85BB4Db75b030693FC256767BcD000958A1e99d8e7Ae98d08C23701',
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

/** "alt:T53E2A…f393": the first 10 and last 4 characters, for tight spaces; the full text stays in `title`. */
export const shortId = (id: string, head = 10, tail = 4) => (id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`);

/** How identifiers are written (APS-0002). Aletheia never uses the 0x prefix. */
export const IDENTIFIER_FORMATS = [
  { what: 'Account address', form: 'alt:…', example: EXAMPLE.address },
  { what: 'Transaction ID', form: 'alt:T…', example: EXAMPLE.tx[0] },
  { what: 'Block ID', form: 'alt:B…', example: EXAMPLE.block[0] },
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
