import type { ReactNode } from 'react';
import { routeMetadataFor } from '@/lib/routes';

export const generateMetadata = routeMetadataFor('/design-system');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
