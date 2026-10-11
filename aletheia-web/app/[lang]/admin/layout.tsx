import type { Metadata } from 'next';
import { PRIVATE_METADATA } from '@/lib/routes';
import { ServiceNotOpen } from '@/components/layout/ServiceNotOpen';

export const metadata: Metadata = { ...PRIVATE_METADATA, title: 'Officer Administration' };

// No live registry system yet: every admin route shows that it is not open, instead of a
// simulated officer sign-in. The pages stay in the codebase for when it opens.
export default function AdminLayout() {
  return <ServiceNotOpen area="admin" />;
}
