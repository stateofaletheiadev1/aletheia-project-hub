'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { useEffect, useState } from 'react';
import { usePathname } from '@/lib/i18n/navigation';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

/** Elements on public pages that rise into view as the reader scrolls. */
const REVEAL_SELECTOR = [
  'main section h2',
  'main .eyebrow',
  'main .sovereign-card-premium',
  'main .sovereign-card',
  'main .feature-card',
  'main .dark-feature-card',
  'main .stat-tile',
  'main .photo-card',
  'main [data-reveal]',
].join(',');

const PRIVATE_PREFIXES = ['/portal', '/admin', '/officer'];

function isPrivate(pathname: string | null) {
  return !!pathname && PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));
}

function useRevealOnScroll(pathname: string | null) {
  useEffect(() => {
    if (isPrivate(pathname)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const fold = window.innerHeight;
    // Only elements that start below the fold are hidden — nothing visible ever flashes.
    const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)).filter(
      (el) => !el.closest('[data-no-reveal]') && el.getBoundingClientRect().top > fold,
    );

    const timers = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);

          // Stagger siblings that enter together, e.g. a grid of cards.
          const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
          const delay = Math.min(siblings.indexOf(el), 5) * 80;
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('reveal-in');
          el.classList.remove('reveal-pending');

          // Hand control back to the element's own hover transitions once settled.
          const timer = window.setTimeout(() => {
            el.classList.remove('reveal-in');
            el.style.transitionDelay = '';
            timers.delete(timer);
          }, 1000 + delay);
          timers.add(timer);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    for (const el of targets) {
      el.classList.add('reveal-pending');
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      for (const el of targets) el.classList.remove('reveal-pending', 'reveal-in');
    };
  }, [pathname]);
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}

function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 900);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t("Back to top")}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-sm bg-navy-deep/90 border border-gold/40 text-gold backdrop-blur-md shadow-elevated flex items-center justify-center transition-all duration-300 hover:bg-navy hover:border-gold hover:-translate-y-0.5 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}

/** Site-wide public chrome: reading progress, scroll reveal, back-to-top. */
export function SiteChrome() {
  const pathname = usePathname();
  useRevealOnScroll(pathname);

  if (isPrivate(pathname)) return null;
  return (
    <>
      <ScrollProgress />
      <BackToTop />
    </>
  );
}
