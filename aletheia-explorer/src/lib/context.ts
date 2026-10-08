import { getContext, setContext } from "svelte";
import type { Live } from "./live.svelte";

const KEY = Symbol("live");

export const provideLive = (live: Live) => setContext(KEY, live);
export const useLive = () => getContext<Live>(KEY);
