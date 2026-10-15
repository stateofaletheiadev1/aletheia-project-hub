// Primary navigation (brief §13.1). Register names mirror the public record, so an official's
// map of the workbench matches what the public sees. Items appear only when the official holds
// a permission that would let them use the page; the page checks again on the server.

import { REGISTER, REGISTERS } from "@/domain/registers";
import { can, institutionsWhere, type Actor, type Permission } from "@/policy/roles";

export type NavItem = { href: string; label: string; count?: number };
export type NavGroup = { label: string; items: NavItem[] };

const anywhere = (actor: Actor, p: Permission) => {
  const where = institutionsWhere(actor, p);
  return where === "*" || where.length > 0;
};

export function navigationFor(actor: Actor, counts: Record<string, number> = {}): NavGroup[] {
  const groups: NavGroup[] = [];
  const withCount = (href: string, label: string): NavItem => ({ href, label, count: counts[href] });

  const work: NavItem[] = [withCount("/", "Overview"), withCount("/queue", "My queue")];
  if (anywhere(actor, "record.read")) work.push(withCount("/institution", "Assigned to my institution"));
  groups.push({ label: "Work", items: work });

  if (anywhere(actor, "record.read")) {
    groups.push({
      label: "The record",
      items: REGISTERS.map((r) => withCount(`/records/${r}`, r === "opportunities" ? "Opportunities and applications" : REGISTER[r].label)),
    });
  }

  const institutions: NavItem[] = [];
  if (anywhere(actor, "record.read") || anywhere(actor, "institution.manage")) institutions.push(withCount("/institutions", "Directory"));
  if (anywhere(actor, "official.read")) institutions.push(withCount("/officials", "Officials and access"));
  if (institutions.length) groups.push({ label: "Institutions", items: institutions });

  const oversight: NavItem[] = [];
  if (can(actor, "audit.read")) oversight.push(withCount("/audit", "Audit register"));
  if (anywhere(actor, "publication_log.read")) oversight.push(withCount("/publications", "Publication log"));
  if (can(actor, "integration.read")) oversight.push(withCount("/integrations", "Integration health"));
  if (oversight.length) groups.push({ label: "Oversight", items: oversight });

  const settings: NavItem[] = [];
  if (can(actor, "policy.propose") || can(actor, "policy.confirm")) settings.push(withCount("/settings/policies", "Workflow policies"));
  settings.push(withCount("/settings/notifications", "Notification preferences"));
  if (can(actor, "integration.read")) settings.push(withCount("/settings/system", "System"));
  groups.push({ label: "Settings", items: settings });

  return groups;
}

/** The active item: the longest href that prefixes the current path. */
export function activeHref(groups: NavGroup[], pathname: string): string | null {
  let best: string | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    const match = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}
