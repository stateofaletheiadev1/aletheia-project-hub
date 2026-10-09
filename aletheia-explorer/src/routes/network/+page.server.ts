import { follower } from "$lib/server/follower";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=5" });
  return follower.analytics();
};
