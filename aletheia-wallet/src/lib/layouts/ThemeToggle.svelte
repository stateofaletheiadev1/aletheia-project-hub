<script lang="ts">
  // M-09 Theme dusk/dawn: a circular reveal from the toggle via View Transitions, where available.
  import Icon from "$lib/design/icons/Icon.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { onMount } from "svelte";

  let dark = $state(false);
  onMount(() => {
    prefs.init();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => (dark = prefs.theme === "dark" || (prefs.theme === "system" && media.matches));
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  });

  function apply(next: "light" | "dark") {
    prefs.theme = next;
    document.documentElement.dataset.theme = next;
    dark = next === "dark";
  }

  function toggle(event: MouseEvent) {
    const next = dark ? "light" : "dark";
    const root = document.documentElement;
    const start = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } })
      .startViewTransition;
    if (!start || prefs.reduced) {
      apply(next);
      return;
    }
    root.style.setProperty("--sweep-x", `${event.clientX}px`);
    root.style.setProperty("--sweep-y", `${event.clientY}px`);
    root.classList.add("theme-sweep");
    const transition = start.call(document, () => apply(next));
    void transition.finished.finally(() => root.classList.remove("theme-sweep"));
  }
</script>

<button
  type="button"
  class="theme"
  onclick={toggle}
  aria-label={dark ? "Use the Parchment (light) theme" : "Use the Night Ink (dark) theme"}
>
  <Icon name={dark ? "sun" : "moon"} size={18} />
</button>

<style>
  .theme {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-2);
    color: var(--ink-secondary);
  }

  .theme:hover {
    color: var(--ink-heading);
    background: var(--surface-sunken);
  }

  @media (pointer: coarse) {
    .theme {
      width: var(--target-touch);
      height: var(--target-touch);
    }
  }
</style>
