// Unlock throttling with exponential backoff, persisted locally (wallet prompt 11.3). Only a
// count and a time are stored; nothing about the password.

export interface ThrottleState {
  readonly failures: number;
  readonly lockedUntil: number;
}

const FREE_ATTEMPTS = 3;
const BASE_MS = 5_000;
const MAX_MS = 15 * 60_000;

export function delayAfter(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_MS, BASE_MS * 2 ** (failures - FREE_ATTEMPTS));
}

export function recordFailure(state: ThrottleState, now: number): ThrottleState {
  const failures = state.failures + 1;
  return { failures, lockedUntil: now + delayAfter(failures) };
}

export function waitRemaining(state: ThrottleState, now: number): number {
  return Math.max(0, state.lockedUntil - now);
}

const KEY = "aletheia-wallet:unlock-throttle";
const EMPTY: ThrottleState = { failures: 0, lockedUntil: 0 };

export function loadThrottle(storage: Pick<Storage, "getItem"> | null = safeStorage()): ThrottleState {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return EMPTY;
    const value = JSON.parse(raw) as Partial<ThrottleState>;
    return typeof value.failures === "number" && typeof value.lockedUntil === "number"
      ? { failures: value.failures, lockedUntil: value.lockedUntil }
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveThrottle(
  state: ThrottleState,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = safeStorage(),
): void {
  try {
    if (state.failures === 0) storage?.removeItem(KEY);
    else storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // A private window may refuse storage; throttling then lasts for this page only.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
