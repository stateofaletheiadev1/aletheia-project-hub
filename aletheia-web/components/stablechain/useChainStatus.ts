'use client';

import { useEffect, useState } from 'react';
import type { ChainStatus } from '@/lib/stablechain';

/**
 * The chain's status from the website's own server (/api/chain), refreshed every few
 * seconds. `null` until the first answer; `source: 'reference'` when no node answers.
 */
export function useChainStatus(intervalMs = 5_000): ChainStatus | null {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const response = await fetch('/api/chain', { cache: 'no-store' });
        if (!stop && response.ok) setStatus((await response.json()) as ChainStatus);
      } catch {
        if (!stop) setStatus({ live: false, source: 'reference', checkedAt: new Date().toISOString() });
      }
    };
    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [intervalMs]);
  return status;
}
