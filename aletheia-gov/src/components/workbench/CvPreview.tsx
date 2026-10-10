"use client";

import { useRef, useState } from "react";

// Shows a CV inside the workbench. The PDF is drawn page by page onto canvases by pdf.js,
// so the browser's PDF plug-in is never used and the file's own scripts never run.
// Fetching it with ?view=1 records a "cv.preview" audit event.

const MAX_PAGES = 20;

export function CvPreview({ src, downloadHref, title }: { src: string; downloadHref: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [info, setInfo] = useState("");

  async function open() {
    dialog.current?.showModal();
    document.documentElement.style.overflow = "hidden";
    if (status === "ready" || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch(src, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = new Uint8Array(await res.arrayBuffer());

      const pdfjs = await import("pdfjs-dist");
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
      }
      const task = pdfjs.getDocument({ data, enableXfa: false });
      const doc = await task.promise;
      const host = pages.current!;
      host.replaceChildren();
      const width = Math.min(host.clientWidth || 820, 900);
      const count = Math.min(doc.numPages, MAX_PAGES);
      for (let n = 1; n <= count; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width;
        const ratio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * ratio });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.maxWidth = "100%";
        canvas.setAttribute("aria-label", `Page ${n} of ${doc.numPages}`);
        canvas.className = "mx-auto block bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]";
        host.append(canvas);
        await page.render({ canvas, viewport }).promise;
      }
      setInfo(`${doc.numPages} page${doc.numPages === 1 ? "" : "s"}${doc.numPages > MAX_PAGES ? `, first ${MAX_PAGES} shown` : ""}`);
      await task.destroy();
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <button type="button" onClick={open} className="link-ledger font-medium text-navy-800">
        Preview CV
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="cv-preview-title"
        onClose={() => (document.documentElement.style.overflow = "")}
        className="m-auto h-[92vh] w-[min(64rem,96vw)] max-w-none border-0 bg-parchment-100 p-0 text-ink-900 backdrop:bg-navy-950/70"
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule-ledger)] bg-parchment-50 px-5 py-3">
            <div>
              <p id="cv-preview-title" className="font-semibold">
                {title}
              </p>
              <p className="text-[0.8125rem] text-ink-500">{status === "loading" ? "Opening…" : info}</p>
            </div>
            <div className="flex items-center gap-5">
              <a className="link-ledger text-[0.875rem] font-semibold" href={downloadHref}>
                Download PDF
              </a>
              <button
                type="button"
                onClick={close}
                className="min-h-10 border border-navy-800 px-4 text-[0.875rem] font-semibold text-navy-800 hover:bg-navy-800 hover:text-parchment-50"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 py-6">
            {status === "error" ? (
              <p role="alert" className="mx-auto max-w-lg text-center text-[0.9375rem] text-[#9b2c2c]">
                This CV could not be shown here. You can still download it.
              </p>
            ) : null}
            <div ref={pages} className="mx-auto max-w-[900px] space-y-6" />
          </div>
        </div>
      </dialog>
    </>
  );
}
