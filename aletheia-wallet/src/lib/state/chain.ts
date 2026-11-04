// The one chain client the app uses.

import { config } from "$lib/config";
import { ChainClient } from "$lib/stablechain/rpc/client";

export const chain = new ChainClient({ rpcUrl: config.rpcUrl, restUrl: config.restUrl });
