import { seoFor } from "$lib/seo";

export const prerender = true;

export const load = () => ({ seo: seoFor("/about") });
