/**
 * Feature flags, read on the server.
 *
 * FEATURE_APPLICATIONS — the citizenship, e-residency and portal application flows,
 * which collect identity documents. Off unless set to "true": Aletheia does not accept
 * applications in its founding phase. The code stays in place behind this flag.
 */
export function applicationsOpen(): boolean {
  return process.env.FEATURE_APPLICATIONS === 'true';
}
