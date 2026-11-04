// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
  const __WALLET_CONFIG__: {
    rpcUrl: string;
    restUrl: string;
    wsUrl: string;
    chainId: number;
    network: string;
    genesisBlock: string;
    explorerUrl: string;
    siteUrl: string;
    mainnetSigning: boolean;
    buildHash: string;
  };

  namespace App {
    interface Error {
      message: string;
      hint?: string;
    }
    interface PageData {
      /** Public routes set this; private routes are always noindex. */
      seo?: { title: string; description: string; path: string };
    }
  }
}

export {};
