'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** False during SSR and the hydration pass, true afterwards — without a setState-in-effect re-render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
