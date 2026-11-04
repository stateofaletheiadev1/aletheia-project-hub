// Non-sensitive preferences, kept in localStorage (wallet prompt 5.3, 6.4). Every read and write
// tolerates storage being unavailable.

import type { Precision } from "$lib/formatting/amount";

export type ThemeChoice = "system" | "light" | "dark";
export type MotionChoice = "system" | "reduce" | "full";
export type FeeAssetChoice = "ALnT" | "AEY";

interface Stored {
  theme: ThemeChoice;
  motion: MotionChoice;
  locale: string;
  autoLockMinutes: number;
  precision: Precision;
  feeAsset: FeeAssetChoice;
  activeAccount: number;
}

const KEY = "aletheia-wallet:prefs";
const DEFAULTS: Stored = {
  theme: "system",
  motion: "system",
  locale: "en",
  autoLockMinutes: 5,
  precision: "significant",
  feeAsset: "ALnT",
  activeAccount: 0,
};

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Stored>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

class Prefs {
  theme = $state<ThemeChoice>(DEFAULTS.theme);
  motion = $state<MotionChoice>(DEFAULTS.motion);
  locale = $state(DEFAULTS.locale);
  autoLockMinutes = $state(DEFAULTS.autoLockMinutes);
  precision = $state<Precision>(DEFAULTS.precision);
  feeAsset = $state<FeeAssetChoice>(DEFAULTS.feeAsset);
  activeAccount = $state(DEFAULTS.activeAccount);
  /** True when motion should be reduced, from the setting or the system. */
  reduced = $state(false);

  #loaded = false;

  init(): void {
    if (this.#loaded || typeof window === "undefined") return;
    this.#loaded = true;
    Object.assign(this, load());
    this.autoLockMinutes = Math.min(30, Math.max(1, Math.round(this.autoLockMinutes)));
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      this.reduced = this.motion === "reduce" || (this.motion === "system" && query.matches);
      document.documentElement.dataset.motion = this.reduced ? "reduce" : "full";
    };
    query.addEventListener("change", update);
    $effect.root(() => {
      $effect(() => {
        update();
        if (this.theme === "system") delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = this.theme;
        this.#save();
      });
    });
  }

  #save(): void {
    const value: Stored = {
      theme: this.theme,
      motion: this.motion,
      locale: this.locale,
      autoLockMinutes: this.autoLockMinutes,
      precision: this.precision,
      feeAsset: this.feeAsset,
      activeAccount: this.activeAccount,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      // Preferences then last for this visit only.
    }
  }
}

export const prefs = new Prefs();
