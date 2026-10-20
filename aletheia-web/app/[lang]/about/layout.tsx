import type { ReactNode } from 'react';
import { routeMetadataFor } from '@/lib/routes';

export const generateMetadata = routeMetadataFor('/about');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
