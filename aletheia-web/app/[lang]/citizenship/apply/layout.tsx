import type { ReactNode } from 'react';
import { routeMetadataFor } from '@/lib/routes';
import { applicationsOpen } from '@/lib/features';
import { ServiceNotOpen } from '@/components/layout/ServiceNotOpen';

export const generateMetadata = routeMetadataFor('/citizenship/apply');

// Applications are closed in the founding phase (FEATURE_APPLICATIONS); the form stays behind the flag.
export default function Layout({ children }: { children: ReactNode }) {
  return applicationsOpen() ? children : <ServiceNotOpen area="applications" />;
}
