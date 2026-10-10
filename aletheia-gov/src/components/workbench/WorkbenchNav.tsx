"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function WorkbenchNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/workbench" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Workbench">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className="relative flex min-h-10 items-center whitespace-nowrap px-4 text-[0.9375rem] text-parchment-200 transition-colors hover:bg-navy-900 hover:text-parchment-50 aria-[current=page]:bg-navy-900 aria-[current=page]:font-semibold aria-[current=page]:text-parchment-50 lg:aria-[current=page]:before:absolute lg:aria-[current=page]:before:inset-y-1.5 lg:aria-[current=page]:before:left-0 lg:aria-[current=page]:before:w-[3px] lg:aria-[current=page]:before:bg-gold-500"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
