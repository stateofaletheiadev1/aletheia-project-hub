import "server-only";
import { phases } from "@/content/founding";
import { institutions } from "@/content/institutions";
import { programmes } from "@/content/programmes";
import { STATUS_META, type InstitutionalStatus } from "@/lib/status";

// Unified search over published content. The index is built from the same sources
// the pages render, so search can never surface something the site does not publish.

export type SearchHit = {
  href: string;
  title: string;
  kind: string;
  excerpt: string;
  status?: InstitutionalStatus;
  score: number;
};

type Entry = Omit<SearchHit, "score"> & { body: string };

const PAGES: Entry[] = [
  ["/government", "The founding government", "What the founding government is, what it does, how it is organised and held to account."],
  ["/founding-programme", "The founding programme", "Charter, infrastructure, people, economy, place: the five phases and the current focus."],
  ["/development", "The development framework", "What can be built before there is a place, and what must wait for one."],
  ["/build-aletheia", "Build Aletheia", "Ways to contribute: founding roles and other positions, scrutiny of the record, following the programmes."],
  ["/opportunities", "Opportunities", "Founding roles, permanent, fixed-term, advisory and volunteer positions, jobs, vacancies, recruitment process, two reviewers, published rubric, applications."],
  ["/public-finance", "Public finance", "Reserve Bank and Treasury, budgets, receipts, expenditure, procurement, rules for figures."],
  ["/documents", "Documents", "Document library: founding texts, frameworks, specifications, reports, versions and hashes."],
  ["/decisions", "Decisions", "Published institutional decisions with references and change history."],
  ["/dispatches", "Dispatches", "Announcements and notices from the founding government."],
  ["/appointments", "Appointments", "Verified appointments to positions, issued by an appointing authority."],
  ["/directory", "Directory", "Institutions and published officeholders."],
  ["/events", "Events", "Public sessions, briefings and meetings."],
  ["/privacy", "Privacy", "What data this site collects and why: no cookies, no analytics."],
  ["/accessibility", "Accessibility", "Accessibility statement, WCAG 2.2 AA, known issues, how to report a problem."],
].map(([href, title, excerpt]) => ({ href: href!, title: title!, kind: "Page", excerpt: excerpt!, body: excerpt! }));

const INDEX: Entry[] = [
  ...institutions.map((i) => ({
    href: `/institutions/${i.slug}`,
    title: i.name,
    kind: i.kind === "Ministry" ? "Ministry" : "Institution",
    excerpt: i.mandate,
    status: i.status,
    body: [i.mandate, ...i.summary, ...i.responsibilities, i.kind].join(" "),
  })),
  ...programmes.map((p) => ({
    href: `/projects/${p.slug}`,
    title: p.name,
    kind: "Programme",
    excerpt: p.line,
    status: p.status,
    body: [p.line, ...p.summary, ...p.scope, p.lead].join(" "),
  })),
  ...phases.map((ph) => ({
    href: "/founding-programme",
    title: `Phase ${ph.numeral}: ${ph.name}`,
    kind: "Founding programme",
    excerpt: ph.aim,
    status: ph.status,
    body: [ph.aim, ...ph.work].join(" "),
  })),
  ...PAGES,
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function search(query: string, limit = 50): SearchHit[] {
  const terms = norm(query)
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  for (const e of INDEX) {
    const title = norm(e.title);
    const body = norm(e.body);
    const status = e.status ? norm(STATUS_META[e.status].label) : "";
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += title.startsWith(t) ? 6 : 4;
      else if (body.includes(t) || status.includes(t)) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (score > 0) hits.push({ href: e.href, title: e.title, kind: e.kind, excerpt: e.excerpt, status: e.status, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
