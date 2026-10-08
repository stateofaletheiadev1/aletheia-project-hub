import { follower } from "$lib/server/follower";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = () => ({ snapshot: follower.snapshot() as Extract<ReturnType<typeof follower.snapshot>, { kind: "snapshot" }> });
