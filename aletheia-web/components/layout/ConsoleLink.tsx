'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/**
 * A link into the officer console. It loads the page in full instead of navigating inside the
 * app, so on stateofaletheia.org the browser follows the move to the console's own address
 * (adss.oiss.stateofaletheia.org) and the address bar shows it.
 */
export function ConsoleLink({ href, ...props }: Omit<ComponentProps<typeof NextLink>, 'href'> & { href: string }) {
  return (
    <NextLink
      href={href}
      prefetch={false}
      onNavigate={(e) => {
        e.preventDefault();
        window.location.assign(href);
      }}
      {...props}
    />
  );
}
