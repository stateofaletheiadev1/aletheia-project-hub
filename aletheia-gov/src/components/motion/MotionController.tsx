"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// One small island drives every reveal and parallax on the page.
// Server markup carries inert attributes (data-reveal-on, data-clip-on, data-parallax);
// without JavaScript nothing is hidden. Only elements below the fold are set to
// "pending" before they are observed, so nothing visible ever flashes.
export function MotionController() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fold = window.innerHeight * 0.94;

    const reveal = (el: Element, attr: "data-reveal" | "data-clip") => el.setAttribute(attr, "shown");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          if (el.hasAttribute("data-reveal-on")) reveal(el, "data-reveal");
          if (el.hasAttribute("data-clip-on")) reveal(el, "data-clip");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const targets = document.querySelectorAll<HTMLElement>("[data-reveal-on], [data-clip-on]");
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < fold) return;
      if (el.hasAttribute("data-reveal-on")) el.setAttribute("data-reveal", "pending");
      if (el.hasAttribute("data-clip-on")) el.setAttribute("data-clip", "pending");
      io.observe(el);
    });

    // Parallax: transform-only, at most ~8 % of the element's own height.
    const layers = reduce ? [] : Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const el of layers) {
        const box = el.parentElement?.getBoundingClientRect();
        if (!box || box.bottom < 0 || box.top > vh) continue;
        const k = Math.min(Number(el.dataset.parallax) || 0, 0.08);
        const progress = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2);
        el.style.transform = `translate3d(0, ${(-progress * k * box.height).toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    if (layers.length) {
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
