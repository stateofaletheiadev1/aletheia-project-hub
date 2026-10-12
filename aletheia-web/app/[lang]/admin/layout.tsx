import type { Metadata } from 'next';
import { PRIVATE_METADATA } from '@/lib/routes';
import { connection } from 'next/server';
import { ServiceNotOpen } from '@/components/layout/ServiceNotOpen';
import { databaseConfigured } from '@/lib/server/db';

export const metadata: Metadata = { ...PRIVATE_METADATA, title: 'Officer Administration' };

// Officer administration runs on AletheiaDB. Without a database connection (ALETHEIADB_URL)
// every admin route says that it is not open, instead of showing a sign-in that cannot work.
export default async function AdminLayout({ children }: LayoutProps<'/[lang]/admin'>) {
  await connection();
  if (!databaseConfigured()) return <ServiceNotOpen area="admin" />;
  return children;
}
