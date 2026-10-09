"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { primaryNav, recordNav } from "@/lib/site";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="5.25" />
      <path d="m11 11 3.75 3.75" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const recordMenu = useRef<HTMLDivElement>(null);
  const recordActive = recordNav.some((l) => isActive(pathname, l.href));

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus after navigation and move focus to the new page's heading (brief §17).
  const first = useRef(true);
  useEffect(() => {
    drawer.current?.close();
    try {
      recordMenu.current?.hidePopover();
    } catch {}
    if (first.current) {
      first.current = false;
      return;
    }
    const heading = document.getElementById("page-title") ?? document.querySelector<HTMLElement>("main h1");
    heading?.focus({ preventScroll: true });
  }, [pathname]);

  const openDrawer = () => {
    drawer.current?.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const onDrawerClose = () => {
    document.documentElement.style.overflow = "";
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 h-[var(--header-h)] transition-[background-color,border-color] duration-[var(--dur-base)] ${
          solid ? "border-b border-[var(--rule-sea)] bg-navy-950" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="shell flex h-full items-center justify-between gap-6 text-parchment-100">
          <Link href="/" className="group flex items-center gap-3.5">
            <Mark size={26} />
            <span className="flex flex-col leading-none">
              <span className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-gold-400">The Government of</span>{" "}
              <span className="mt-1 text-[1.0625rem] font-medium tracking-[0.14em] uppercase">Aletheia</span>
              <span className="sr-only">, home</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
            <ul className="flex items-center gap-7">
              {primaryNav.map((l) => {
                const active = isActive(pathname, l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`draw-link text-[0.9375rem] font-medium transition-colors ${
                        active ? "bg-[length:100%_1px] text-gold-300" : "text-parchment-100 hover:text-white"
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  popoverTarget="record-menu"
                  className={`flex items-center gap-1.5 text-[0.9375rem] font-medium ${recordActive ? "text-gold-300" : "text-parchment-100 hover:text-white"}`}
                >
                  Record
                  <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className="mt-px">
                    <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </button>
              </li>
            </ul>
            <span aria-hidden className="h-5 w-px bg-[var(--rule-sea)]" />
            <Link
              href="/search"
              aria-current={isActive(pathname, "/search") ? "page" : undefined}
              className="flex items-center gap-2 text-[0.9375rem] font-medium text-parchment-100 hover:text-white"
            >
              <SearchIcon />
              Search
            </Link>
            <Link href="/sign-in" className="text-[0.875rem] text-parchment-300 hover:text-parchment-50">
              Sign in
            </Link>
          </nav>

          <button
            type="button"
            onClick={openDrawer}
            className="-mr-2 flex min-h-11 items-center gap-3 px-2 text-[0.875rem] font-semibold uppercase tracking-[0.14em] lg:hidden"
            aria-haspopup="dialog"
          >
            Menu
            <span aria-hidden className="flex w-6 flex-col gap-[5px]">
              <span className="h-px w-full bg-current" />
              <span className="h-px w-2/3 self-end bg-current" />
            </span>
          </button>
        </div>
      </header>

      {/* Record menu: a full-width index strip below the header */}
      <div id="record-menu" ref={recordMenu} popover="auto" className="record-menu sea">
        <div className="shell grid-12 py-10">
          <p className="t-meta col-span-12 text-gold-400 lg:col-span-3">The public record</p>
          <ul className="col-span-12 mt-6 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:col-span-9 lg:mt-0 lg:grid-cols-3">
            {recordNav.map((l) => (
              <li key={l.href} className="border-t rule">
                <Link href={l.href} className="group block py-4" aria-current={isActive(pathname, l.href) ? "page" : undefined}>
                  <span className="flex items-center justify-between text-[1.125rem] font-medium text-parchment-50">
                    {l.label}
                    <span aria-hidden className="arrow-nudge text-gold-400">→</span>
                  </span>
                  <span className="mt-1 block text-[0.875rem] text-parchment-300">{l.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile drawer: native modal dialog — focus is contained, Escape closes, focus returns. */}
      <dialog ref={drawer} onClose={onDrawerClose} aria-label="Site menu" className="drawer sea">
        <div className="flex min-h-full flex-col">
          <div className="shell flex h-[var(--header-h)] items-center justify-between border-b rule">
            <span className="flex items-center gap-3.5">
              <Mark size={24} />
              <span className="text-[1rem] font-medium uppercase tracking-[0.14em]">Aletheia</span>
            </span>
            <button
              type="button"
              onClick={() => drawer.current?.close()}
              className="-mr-2 flex min-h-11 items-center gap-3 px-2 text-[0.875rem] font-semibold uppercase tracking-[0.14em]"
            >
              Close
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
          <nav aria-label="Mobile" className="shell flex-1 py-10">
            <ul className="space-y-1">
              {[...primaryNav, { href: "/search", label: "Search" }].map((l, i) => (
                <li key={l.href} className="drawer-item" style={{ "--i": i } as React.CSSProperties}>
                  <Link
                    href={l.href}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className="block py-2 text-[2.25rem] font-light leading-tight tracking-[-0.02em] text-parchment-50 aria-[current=page]:text-gold-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="t-meta drawer-item mt-12 text-gold-400" style={{ "--i": 7 } as React.CSSProperties}>
              The public record
            </p>
            <ul className="drawer-item mt-4 grid grid-cols-2 gap-x-6" style={{ "--i": 8 } as React.CSSProperties}>
              {recordNav.map((l) => (
                <li key={l.href} className="border-t rule">
                  <Link href={l.href} className="block py-3 text-[1.0625rem] text-parchment-100">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="drawer-item mt-12 flex gap-8 text-[0.9375rem] text-parchment-300" style={{ "--i": 9 } as React.CSSProperties}>
              <Link href="/build-aletheia">Build Aletheia</Link>
              <Link href="/sign-in">Sign in</Link>
            </div>
          </nav>
        </div>
      </dialog>
    </>
  );
}
