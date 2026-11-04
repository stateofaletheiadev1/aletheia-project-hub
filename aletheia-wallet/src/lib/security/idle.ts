// Idle auto-lock and lock-on-hide (wallet prompt 11.3). Calls `onLock` after `idleMs` without
// input, or when the tab has been hidden longer than `hiddenMs`.

export interface IdleOptions {
  readonly idleMs: number;
  readonly hiddenMs: number;
  readonly onLock: () => void;
  readonly target?: Window & typeof globalThis;
}

const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

export function watchIdle({ idleMs, hiddenMs, onLock, target = window }: IdleOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hiddenAt: number | null = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onLock, idleMs);
  };
  const onVisibility = () => {
    if (target.document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt !== null && Date.now() - hiddenAt > hiddenMs) onLock();
    hiddenAt = null;
    arm();
  };
  for (const name of ACTIVITY) target.addEventListener(name, arm, { passive: true });
  target.document.addEventListener("visibilitychange", onVisibility);
  arm();
  return () => {
    if (timer) clearTimeout(timer);
    for (const name of ACTIVITY) target.removeEventListener(name, arm);
    target.document.removeEventListener("visibilitychange", onVisibility);
  };
}
