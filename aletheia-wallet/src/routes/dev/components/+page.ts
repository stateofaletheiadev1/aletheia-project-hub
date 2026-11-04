// The component gallery exists in development only (wallet prompt 9).
import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

export const ssr = false;
export const prerender = false;

export function load() {
  if (!dev) error(404, { message: "Not found" });
}
