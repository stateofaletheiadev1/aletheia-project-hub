import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PRIVATE_METADATA } from '@/lib/routes';

export const metadata: Metadata = { ...PRIVATE_METADATA, title: 'Citizen Portal' };

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}
