import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PRIVATE_METADATA } from '@/lib/routes';

export const metadata: Metadata = { ...PRIVATE_METADATA, title: 'Officer Access' };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
