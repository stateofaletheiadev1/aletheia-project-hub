import type { ReactNode } from 'react';
import { routeMetadataFor } from '@/lib/routes';

export const generateMetadata = routeMetadataFor('/government/ministry-of-foreign-affairs');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
