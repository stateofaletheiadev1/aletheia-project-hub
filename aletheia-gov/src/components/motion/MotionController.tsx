"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// One small island drives every reveal and parallax on the page.
// Server markup carries inert attributes (data-reveal-on, data-clip-on, data-parallax);
// without JavaScript nothing is hidden.
//
// Performance (brief §16): setup waits for an idle moment so it never competes with
// hydration, and positions come from IntersectionObserver entries rather than from
// reading layout, so loading the page forces no synchronous reflow.
export function MotionController() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    const init = () => {
      if (cancelled) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Reveals. The first callback for each target reports where it is: anything already
      // on screen (or above it) stays as it is; only elements below the fold are hidden
      // until they arrive, so nothing visible ever flashes.
      const seen = new WeakSet<Element>();
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const el = e.target;
            const first = !seen.has(el);
            seen.add(el);
            if (first) {
              const below = e.boundingClientRect.top > (e.rootBounds?.bottom ?? window.innerHeight);
              if (e.isIntersecting || !below) {
                io.unobserve(el);
                continue;
              }
              if (el.hasAttribute("data-reveal-on")) el.setAttribute("data-reveal", "pending");
              if (el.hasAttribute("data-clip-on")) el.setAttribute("data-clip", "pending");
              continue;
            }
            if (!e.isIntersecting) continue;
            if (el.hasAttribute("data-reveal-on")) el.setAttribute("data-reveal", "shown");
            if (el.hasAttribute("data-clip-on")) el.setAttribute("data-clip", "shown");
            io.unobserve(el);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      document.querySelectorAll("[data-reveal-on], [data-clip-on]").forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());

      if (reduce) return;

      // Parallax: transform-only, at most 8 %, and only for layers currently on screen.
      const visible = new Set<HTMLElement>();
      const watch = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const layer = e.target.querySelector<HTMLElement>(":scope > [data-parallax], :scope [data-parallax]");
          if (!layer) continue;
          if (e.isIntersecting) visible.add(layer);
          else visible.delete(layer);
        }
        schedule();
      });
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((layer) => {
        if (layer.parentElement) watch.observe(layer.parentElement);
      });
      cleanups.push(() => watch.disconnect());

      let frame = 0;
      const update = () => {
        frame = 0;
        const vh = window.innerHeight;
        for (const el of visible) {
          const box = el.parentElement!.getBoundingClientRect();
          const k = Math.min(Number(el.dataset.parallax) || 0, 0.08);
          const progress = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2);
          el.style.transform = `translate3d(0, ${(-progress * k * box.height).toFixed(1)}px, 0)`;
        }
      };
      const schedule = () => {
        if (!frame && visible.size) frame = requestAnimationFrame(update);
      };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      cleanups.push(() => {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        if (frame) cancelAnimationFrame(frame);
      });
    };

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(init, { timeout: 1200 })
      : window.setTimeout(init, 200);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cleanups.forEach((fn) => fn());
    };
  }, [pathname]);

  return null;
}
