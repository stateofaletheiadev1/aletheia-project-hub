import { Colophon } from "@/components/editorial/Colophon";
import { MotionController } from "@/components/motion/MotionController";
import { Header } from "@/components/navigation/Header";

/** Header, skip link, main landmark, colophon: the frame of every public page. */
export function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-4 z-[60] -translate-y-24 bg-parchment-50 px-4 py-3 text-[0.9375rem] font-semibold text-navy-800 focus:translate-y-0"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Colophon />
      <MotionController />
    </>
  );
}
