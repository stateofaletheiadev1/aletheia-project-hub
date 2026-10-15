import type { ReactNode } from "react";
import { Arms } from "../brand/Arms";
import { Contours } from "../brand/Contours";

// The frame of the screens before sign-in (brief §8: the arms and the contours belong here):
// navy like the portal's mastheads, one sheet in the middle for the form.

export function AuthShell({ title, lede, children, footer }: { title: string; lede?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="on-navy relative flex min-h-dvh items-center justify-center overflow-hidden bg-masthead px-4 py-12">
      <Contours variant="a" tone="light" opacity={0.08} />
      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Arms height={88} priority />
          <p className="caps mt-5 text-seal-on-navy">Government of Aletheia</p>
          <p className="mt-1 text-ui font-semibold text-ink-inverse">Operations</p>
        </div>
        <div className="mt-8 rounded-sm bg-sheet p-6 text-ink shadow-pop md:p-8">
          <h1 className="text-h2 text-ink">{title}</h1>
          {lede ? <div className="mt-2 text-ui font-normal text-ink-2">{lede}</div> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-meta text-ink-inverse-2">{footer}</div> : null}
        <p className="mt-8 text-center text-meta text-ink-inverse-2">Veritas in Foedere</p>
      </div>
    </main>
  );
}
