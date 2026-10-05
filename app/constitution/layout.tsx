import type { ReactNode } from 'react';
import { routeMetadata } from '@/lib/routes';

export const metadata = routeMetadata('/constitution');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
